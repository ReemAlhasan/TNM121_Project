// _____________________ BASIC SERVER SETUP _____________________
// Include built‑in Node modules
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Server properties
const hostname = "127.0.0.1";
const port = 3000;
const serverUrl = "http://" + hostname + ":" + port;

// Include MongoDB driver
const MongoClient = require("mongodb").MongoClient;

// DB server properties
const dbHostname = "127.0.0.1";
const dbPort = 27017;
const dbServerUrl = "mongodb://" + dbHostname + ":" + dbPort;

// MongoDB client
const dbClient = new MongoClient(dbServerUrl);

// Database / collection names
const dbName = "tnm121-project";
const dbImdbCollectionName = "imdb";
const dbActorInfoCollectionName = "actorinfo";
const dbBechdelCollectionName = "bechdel";

// Additional meta 
const systemName = "TNM121 Project MongoDB Server";

// _____________________ MIME TYPE HANDLER _____________________
const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".txt": "text/plain"
};

// _____________________ GLOBALS (DB + COLLECTION + ID CACHE) _____________________
let db = null;
let imdbCollection = null;
let idArray = []; // will hold all { normalized_id } from imdb collection

// _____________________ INITIAL DB SETUP _____________________
async function initDatabase() {
    console.log("Connecting to MongoDB at " + dbServerUrl + " ...");
    await dbClient.connect();

    db = dbClient.db(dbName);
    imdbCollection = db.collection(dbImdbCollectionName);

    console.log("Connected to database:", dbName);
    console.log("Using collection:", dbImdbCollectionName);

    await loadIdArray(); // fill idArray once at startup
}

// Load all normalized_id values into idArray
async function loadIdArray() {
    const projectionQuery = { normalized_id: 1 };
    idArray = await imdbCollection
        .find({})
        .project(projectionQuery)
        .toArray();

    const mediaDir = path.join(__dirname, "media");

  // Behåll bara de filmer som har en motsvarande .png-fil i media/
   const moviesWithImages = [];

  for (const i of idArray) {
    const filename = i.normalized_id + ".png";           // t.ex. "567.png"
    const filePath = path.join(mediaDir, filename);        // t.ex. ".../media/567.png"

    if (fs.existsSync(filePath)) {                         // om filen finns
      moviesWithImages.push(i);                          // lägg till i listan
    }
  }
  idArray = moviesWithImages;

    console.log("ID cache loaded. Number of movies:", idArray.length);
    if (idArray.length > 0) {
        console.log("First ID:", idArray[0]);
        console.log("Last  ID:", idArray[idArray.length - 1]);
    }
}

// _____________________ RANDOM MOVIE HELPERS _____________________

// Get ONE random movie document from imdb collection
async function getRandomMovie() {
    if (!imdbCollection || idArray.length === 0) {
        throw new Error("Database or ID array not initialized.");
    }

    const randomIndex = Math.floor(Math.random() * idArray.length);
    const randomId = idArray[randomIndex].normalized_id;

    const findQuery = { normalized_id: randomId };

    // No projection here → return the entire document (all fields: name, rating, year, image, etc.)
    const docs = await imdbCollection.find(findQuery).toArray();

    // docs is an array, but we expect exactly one document for this ID
    return docs[0];
}

// Get TWO random movies (may occasionally be the same; you can handle that later if you want)
async function getTwoRandomMovies() {
    const movie1 = await getRandomMovie();
    const movie2 = await getRandomMovie();
    return [movie1, movie2];
}

// _____________________ HTTP SERVER & ROUTING _____________________
const server = http.createServer(async (req, res) => {
    console.log("Incoming request:", req.method, req.url);

    const requestUrl = new URL(serverUrl + req.url);
    const pathComponents = requestUrl.pathname.split("/");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        sendResponse(res, 204, null, null);
        return;
    }

    // Only handling GET for now
    if (req.method === "GET") {
        const endpoint = pathComponents[1]; //  "startGame" or "getMovieInfo"
        console.log("API endpoint:", endpoint);

        try {
            switch (endpoint) {
                // *************** NY ROUTE FÖR BILDER ***************
                case "media": {                       
                    // URL ser ut så här: /media/574.png    
                    const filename = pathComponents[2];     
                    
                    const filePath = path.join(__dirname, "media", filename); 
                    fs.readFile(filePath, (err, data) => {
                        if (err) {                          
                            console.error(err);                
                            sendResponse(res, 404, "text/plain", "Image not found");
                        } else {                             
                            sendResponse(res, 200, "image/png", data);            
                        }                                   
                    });                                    
                    break;    
                }                             

        // --------------- "startGame" ---------------
        // Client presses Start Game button ->
        // respond with an array of 2 random movie objects
                case "startGame": {
                    console.log("Routing: startGame");
                    const movies = await getTwoRandomMovies();
                    const jsonData = JSON.stringify(movies);
                    sendResponse(res, 200, "application/json", jsonData);
                    break;
                }

                // --------------- "getMovieInfo" ---------------
                // Client answered correctly ->
                // respond with ONE random movie object
                case "getMovieInfo": {
                    console.log("Routing: getMovieInfo");
                    const movie = await getRandomMovie();
                    const jsonData = JSON.stringify([movie]); // keep array format so it matches old client code
                    sendResponse(res, 200, "application/json", jsonData);
                    break;
                }

                // --------------- Default: no specific API requested ---------------
                default: {
                    sendResponse(
                        res,
                        200,
                        "text/plain",
                        "Default response from Node.js server. No specific client request."
                    );
                    break;
                }
            }
        } catch (error) {
            console.error("Error while handling request:", error);
            sendResponse(res, 500, "text/plain", "Internal server error.");
        }
    } else {
        // Methods other than GET/OPTIONS
        sendResponse(
            res,
            405,
            "text/plain",
            "Method not allowed. Use GET or OPTIONS."
        );
    }
});

// _____________________ RESPONSE HELPER _____________________
function sendResponse(res, statusCode, contentType, data) {
    console.log("Sending response with status", statusCode);
    res.statusCode = statusCode;

    if (contentType != null) {
        res.setHeader("Content-Type", contentType);
    }

    // CORS headers so the client (browser) can call the API
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (data != null) {
        res.end(data);
    } else {
        res.end();
    }
}

// _____________________ START SERVER _____________________
initDatabase()
    .then(() => {
        server.listen(port, hostname, () => {
            console.log("The server is running and listening at " + serverUrl);
        });
    })
    .catch((err) => {
        console.error("Failed to initialize database:", err);
        process.exit(1);
    });

// (Optional) clean shutdown
process.on("SIGINT", async () => {
    console.log("\nShutting down server...");
    await dbClient.close();
    process.exit(0);
});