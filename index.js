import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Import the Client class using ES modules
const { Client } = pg;

const db = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

db.connect((err) => {
    if (err) {
        console.error('Database connection error:', err);
        throw err;
    }
    console.log('Connected to PostgreSQL database');
})

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json()); // This is crucial for parsing JSON in POST requests

const port = 3000;

app.set("view engine", "ejs");
app.set("views", __dirname + "/view");

app.use(express.static("public"));
app.use(express.static("view"));
app.use(bodyParser.urlencoded({ extended: true }));



async function checker(username, password) {
    try {
        const result = await db.query("SELECT * FROM userdetails WHERE username = $1", [username.trim()]);
        console.log("Database result:", result.rows);
        
        if (result.rows.length > 0 && result.rows[0].password === password.trim()) {
            console.log("Authorization success");
            return true;
        }
        
        console.log("Authorization failed");
        return false;
    } catch (error) {
        console.error("Database error:", error);
        return false;
    }
}

async function entries(username, password) {
    try {
        const result = await db.query("SELECT * FROM userdetails WHERE username = $1", [username.trim()]);
        
        if (result.rows.length === 0) {
            await db.query("INSERT INTO userdetails (username, password) VALUES ($1, $2)", [username, password]);
            console.log("User registered:", username);
        } else {
            console.log("Username already exists");
        }
    } catch (error) {
        console.error("Database error:", error);
        return false;
    }
}

async function medicationtable(username, disease, medication, nooftablets) {
    try {
        const result = await db.query(
            "INSERT INTO medicationtable (username, disease, medication, nooftablets) VALUES ($1, $2, $3, $4)",
            [username, disease, medication, nooftablets]
        );
        console.log("Inserted medication data:", result.rowCount); // Log row count to confirm insertion
    } catch (error) {
        console.error("Database error:", error.message); // Log error message for troubleshooting
    }
}


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/view/index.html");
});

app.post("/check", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    const isAuthorized = await checker(username, password);
    if (isAuthorized) {
        res.render("home", { username });
    } else {
        res.sendFile(__dirname + "/view/index.html");
    }
});

app.get("/register", (req, res) => {
    res.sendFile(__dirname + "/view/register.html");
});

app.get("/about", (req, res) => {
    res.sendFile(__dirname + "/view/about.html");
});

app.post("/register", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    await entries(username, password);
    res.redirect("/");
});

app.get("/admin", async (req, res) => {
    res.render("map", { username: "admin" });
});


app.get("/logout", (req, res) => {
    res.sendFile(__dirname + "/view/index.html")});

app.get("/map", async (req, res) => {
        const username = req.query.username || req.body.username; // Adjust based on query or body
        console.log("username:", username);
        res.render("usermap", { username }); // Render map page with username
    });
    






app.post("/table", async (req, res) => {
    const { username, disease, medication, nooftablets } = req.body;
    
    if (!username || !disease || !medication || !nooftablets) {
        console.error("Received incomplete data:", req.body);
        return res.status(400).send("All fields are required.");
    }

    console.log("Received table data:", username, disease, medication, nooftablets);
    await medicationtable(username, disease, medication, nooftablets);
    res.send("Data received successfully");
});

app.post("/update-house", async (req, res) => {
    console.log("Received request body:", req.body); 
    const { username, house_id } = req.body;

    try {
        const result = await db.query(
            "UPDATE MEDICATIONTABLE SET house_id = $1 WHERE username = $2",
            [house_id, username]
        );
        console.log(`Updated house ID for ${username} to ${house_id}`);
        res.status(200).send("House ID updated successfully.");
    } catch (error) {
        console.error("Error updating house ID:", error.message);
        res.status(500).send("Error updating house ID.");
    }
});

app.post("/update-need", async (req, res) => {
    console.log("Received request body:", req.body);
    const { house_id, need } = req.body;

    // Input validation: Check for missing or invalid values
    if (!house_id || !need) {
        return res.status(400).json({ error: "house_id and number are required." });
    }

    try {
        // Insert data into the database
        const result = await db.query(
            'INSERT INTO "addictionalneed" (house_id, needs) VALUES ($1, $2)',
            [house_id, need]
        );
        
        console.log(`Inserted additional need data: ${house_id}, ${need}`);
        res.status(200).json({ message: "Additional need data inserted successfully." });

    } catch (error) {
        console.error("Error inserting additional need data:", error.message);
        res.status(500).json({ error: "Error inserting additional need data." });
    }
});


app.get("/get-cold-houses", async (req, res) => {
    try {
        // Query to fetch all houses with the condition "cold"
        const result = await db.query(
            "SELECT house_id FROM medicationtable WHERE TRIM(disease) = $1",
            ["cold"]
        );

        console.log("Query Result:", result.rows);

        if (result.rows.length > 0) {
            const house_ids = result.rows.map(row => row.house_id);
            console.log("Found houses for cold condition:", house_ids);
            res.status(200).json({ house_ids });
        } else {
            console.log("No houses found for cold condition.");
            res.status(404).json({ message: "No houses found for the given condition." });
        }
    } catch (error) {
        console.error("Error fetching house data:", error.message);
        res.status(500).send("Internal Server Error");
    }
});




app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
