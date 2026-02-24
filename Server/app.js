//___________________ BASIC SERVER SET UP ___________________________________________

//------ include models --------
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

//------ server properties ------
const hostname = "127.0.0.1";
const port = 3000;
const serverUrl = "http://" + hostname + ":" + port + "";

//___________________ BASIC MOMGODB CONNECTION ________________________________________

//------ include models --------
const MongoClient = require("mongodb").MongoClient;

//------ db server properties ------
const dbHostname = "127.0.0.1";
const dbPort = 27017;
const dbServerUrl = "mongodb://" + dbHostname + ":" + dbPort + "";

//------- db object representing connection to db database ----------- 
const dbClient = new MongoClient(dbServerUrl);

//------- inintial Colleciton ---------
const dbName = "tnm121-sus";
const dbCollectionName = "sus-submissions";

//------- addidtional meta data -------
const systemName = "Client_Server_Database";

//_____________________ MIME TYPE HANDLER________________________________________________

// -------- Map file extensions to correct MIME types ------
const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".txt": "text/plain"
};

//___________________ INCOMING MESSAGE ROUTING ____________________________________________
const server = http.createServer((req, res) => {


    //---------------------------- API ENDPOINTS -------------------------
    /** 
     * 
     * 
     * 
     * 
     * case: serverUrl//button1       -> Respond with JSON data from MongoDb database
     * deafult: serverUrl//           -> Deafult response
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
    */

    //------------ Path handeling ---------
    const requestUrl = new URL(serverUrl + req.url);
    const pathComponents = requestUrl.pathname.split("/");

    //----------- Debug and safty --------------- 
    console.log("Someone has connected to the server.");
    console.log("Request received:", req.method, req.url);
    console.log(requestUrl);
    console.log('API endpoint ' + pathComponents[1]) + ' is sent to raouting';

    //------------------- Handeling client requests ------------------

    // Call function to handle GET request from client 
    if (req.method === "GET") {

        //  -------------HANDELING API ENDPOINTS -------------
        switch (pathComponents[1]) {
            //serverUrl//button1   
            case "button1":
                /** ____________EXAMPEL FROM LAB 4_____________________  
                 * if (pathComponents.length === 2) {
                    console.log('raouting sends to artists fucntion');
                    routing_artists(res);
                }else if (pathComponents.length === 3) {
                    console.log('raouting sends to artistid fucntion');
                    const artistId = pathComponents[2];
                    console.log('artistId:', artistId);
                    routing_artistid(res, artistId);
                }
                break; */
                console.log('routing button1');
                routing_button1(res);
                break;
            //serverUrl
            default:
                sendResponse(res, 200, "text/plain", "Default response fore Node.js server. No specifik client request");
                break;
        }
    } else if (req.method === "OPTIONS") {
        sendResponse(res, 204, null, null);
    } else {
         sendResponse(res, 200, "text/plain", "Default response fore Node.js server. No specifik client request");
    }
});

//___________________ ROUTING REQUESTS API ENDPOINTS _____________________________________

async function routing_button1(res) {

    // ------------- connect to MongoDB server ---------------------
    console.log('button1 funciton is handeling request');
    // establish an active connection to the specified MongoDB server
    await dbClient.connect();  
    // select a specified database on the server
    const db = dbClient.db(dbName);   
    // select a specified (document) collection in the database                 
    const dbCollection = db.collection(dbCollectionName);   
    
    // --------------- Get JSON documents ------------------------
    // slect documetnsin collection 
    const findQuery = {};     
    // sort results (by timestamp, old to new)                      
    const sortQuery = { timestamp: 1 };    
    // fields with value 0: excluded; fields with value 1: included in results   
    const projectionQuery = { item_results: 0 };    
    // adds all queried documents into a javascript array
    const findAllResult = await dbCollection.find(findQuery).sort(sortQuery).project(projectionQuery).toArray();        
    console.log("Found Documents Count:", findResult.length);


    // a JSON object *cannot* be simply transmitted in a HTTP message's body,
    // but it needs to be "serialized" (turned into a string) first
    const jsonDataAsString = JSON.stringify(solarSystemData);
    // send serialized JSON data as MIME type "application/json"
    sendResponse(res, 200, "application/json", jsonDataAsString);
}

//___________________ ADDITIONAL ESSENTIAL FUNCTIONS ____________________

//--------------- Respond to request templete ----------------------
function sendResponse(res, statusCode, contentType, data) {
    console.log('Sending response...');
    res.statusCode = statusCode;
    if (contentType != null) res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (data != null) res.end(data);
    else res.end();
    console.log('response sent');
}

//___________________ SERVER START UPP ____________________
server.listen(port, hostname, () => {
    console.log("The server running and listening at " + serverUrl);
});