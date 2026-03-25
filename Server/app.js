const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const MongoClient = require("mongodb").MongoClient;

const hostname = "127.0.0.1";
const port = 3000;
const dbClient = new MongoClient("mongodb://127.0.0.1:27017");

let imdbCollection;
let validIds = new Set(); // only movies that have a matching .png file will be stored here

// ---------------- DB INIT ----------------

// Connect to MongoDB and prepare the movie pool before the server starts accepting requests
async function initDB() {
    await dbClient.connect();
    const db = dbClient.db("tnm121-project");
    imdbCollection = db.collection("imdb");

    // Go through every movie in the database and check if its poster image actually exists on disk
    // We only want to serve movies that have images — otherwise the game looks broken
    const allIds = await imdbCollection.find({}, { projection: { normalized_id: 1 } }).toArray();
    allIds.forEach(doc => {
        const imgPath = path.join(__dirname, "media", doc.normalized_id + ".png");
        if (fs.existsSync(imgPath)) {
            validIds.add(doc.normalized_id);
        }
    });
    console.log("Server running. Movies with images:", validIds.size);
}

// ---------------- BUILD QUERY FROM PARAMS ----------------

// Translate the URL query parameters sent by the client into a MongoDB filter object
// For example: ?genre=drama&yearMin=2000 becomes { genre: { $elemMatch: ... }, year: { $gte: 2000 } }
function buildQuery(params) {
    const query = {};

    // Always restrict the pool to movies that have a poster image
    query.normalized_id = { $in: Array.from(validIds) };

    // Genre is stored as an array in MongoDB e.g. ["Action", "Drama"]
    // We use $elemMatch with a case-insensitive regex so "drama" matches "Drama"
    const genre = params.get("genre");
    if (genre) {
        query.genre = { $elemMatch: { $regex: new RegExp(`^${genre}$`, "i") } };
    }

    // Certificate filter — also case-insensitive so "pg-13" matches "PG-13"
    const certificate = params.get("certificate");
    if (certificate) {
        query.certificate = { $regex: new RegExp(`^${certificate}$`, "i") };
    }

    // Year range — only apply the boundary that was actually provided
    const yearMin = params.get("yearMin");
    const yearMax = params.get("yearMax");
    if (yearMin || yearMax) {
        query.year = {};
        if (yearMin) query.year.$gte = Number(yearMin);
        if (yearMax) query.year.$lte = Number(yearMax);
    }

    // Runtime is stored as a string like "120 min" so we need $expr to parse out the number
    // before we can compare it to the min/max values from the client
    const runtimeMin = params.get("runtimeMin");
    const runtimeMax = params.get("runtimeMax");
    if (runtimeMin || runtimeMax) {
        const conditions = [];
        if (runtimeMin) conditions.push({ $gte: [{ $toInt: { $arrayElemAt: [{ $split: ["$runtime", " "] }, 0] } }, Number(runtimeMin)] });
        if (runtimeMax) conditions.push({ $lte: [{ $toInt: { $arrayElemAt: [{ $split: ["$runtime", " "] }, 0] } }, Number(runtimeMax)] });
        query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    return query;
}

// ---------------- FILTERED RANDOM ----------------

// Pick one random movie from the database that matches the given query
async function getRandomMovie(query) {
    const result = await imdbCollection.aggregate([
        { $match: query },      // filter to only matching movies
        { $sample: { size: 1 } } // pick one at random — MongoDB handles this efficiently
    ]).toArray();

    return result[0]; // returns undefined if no movies matched
}

// Pick two different random movies for the start of a game round
async function getTwoMovies(query) {
    const m1 = await getRandomMovie(query);

    // If nothing came back, the filters were too strict — tell the caller
    if (!m1) return null;

    let m2;
    let attempts = 0;

    // Keep trying until we get a movie that isn't the same as the first one
    // The attempts cap prevents an infinite loop if only one movie matches the filters
    do {
        m2 = await getRandomMovie(query);
        attempts++;
        if (attempts > 10) break;
    } while (m2 && m1.normalized_id === m2.normalized_id);

    if (!m2) return null;

    return [m1, m2];
}

// ---------------- SERVER ----------------

const server = http.createServer(async (req, res) => {

    // Handle CORS preflight requests — browsers send these before cross-origin requests
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        });
        res.end();
        return;
    }

    const url = new URL("http://localhost:3000" + req.url);

    if (req.method === "GET") {

        // Wrap everything in try/catch so unexpected errors don't crash the server
        try {

            if (url.pathname === "/startGame") {
                // Called when the player starts a new game — needs two movies at once
                const query = buildQuery(url.searchParams);
                const movies = await getTwoMovies(query);

                // If the filters are too strict and no movies match, tell the client
                if (!movies) {
                    send(res, 404, { error: "No movies found matching the selected filters. Please try different settings." });
                    return;
                }

                send(res, 200, movies);

            } else if (url.pathname === "/getMovieInfo") {
                // Called after every correct guess — needs one new movie to continue the game
                // Uses the same filters as startGame so the genre/year settings stay consistent
                const query = buildQuery(url.searchParams);
                const movie = await getRandomMovie(query);

                if (!movie) {
                    send(res, 404, { error: "No movie found." });
                    return;
                }

                send(res, 200, [movie]);

            } else if (url.pathname.startsWith("/media")) {
                // Serve a movie poster image as a static file from the media folder
                // The client requests these automatically using the movie's normalized_id
                const file = path.join(__dirname, "media", url.pathname.split("/")[2]);

                fs.readFile(file, (err, data) => {
                    if (err) send(res, 404, "Not found");
                    else send(res, 200, data, "image/png");
                });

            } else {
                // Any other route — just return a basic message
                send(res, 200, { message: "Higher Lower Game API" });
            }

        } catch (error) {
            // Something unexpected went wrong — log it and return a 500 to the client
            console.error("Server error:", error);
            send(res, 500, { error: "Internal server error." });
        }
    }
});

// ---------------- RESPONSE ----------------

// Helper to send a response — handles both JSON and binary data (images)
function send(res, code, data, type = "application/json") {
    res.writeHead(code, {
        "Content-Type": type,
        "Access-Control-Allow-Origin": "*",  // allow requests from any origin (needed for local dev)
        "Access-Control-Allow-Headers": "*"
    });

    // JSON gets serialized, everything else (images) gets sent as-is
    res.end(type === "application/json" ? JSON.stringify(data) : data);
}

// ---------------- START ----------------

// Connect to the database first, then start listening for requests
initDB().then(() => {
    server.listen(port, hostname, () => {
        console.log("Server running on http://127.0.0.1:3000");
    });
}).catch(err => {
    // If we can't connect to MongoDB there's no point running the server
    console.error("Failed to connect to database:", err);
    process.exit(1);
});

// Close the database connection cleanly when the server is stopped with Ctrl+C
process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await dbClient.close();
    process.exit(0);
});