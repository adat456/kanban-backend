var express = require("express");
var router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("redis");
require("dotenv").config();

const UserModel = require("../models/UserModel");

// setting up redis connection
let redisClient = null;
(async () => {
  redisClient = redis.createClient();

  redisClient.on("error", error => {
    console.log(error);
  });
  redisClient.on("connect", () => {
    console.log("Redis connected!");
  });

  await redisClient.connect();
})();

/* create a new user */
router.post("/sign-up", async function(req, res, next) {
  const { firstName, lastName, username, password, email } = req.body;

  try {
    // checking to make sure that username and email are unique
    const existingUsername = await UserModel.findOne({ username: username.trim().toLowerCase() });
    const existingEmail = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (existingUsername && existingEmail) {
      throw new Error("Email and username have already been taken.");
    } else if (existingEmail) {
      throw new Error("Email has already been taken.");
    } else if (existingUsername) {
      throw new Error("Username has already been taken.");
    };

    const userDoc = await UserModel.create({ firstName, lastName, username, password, email });
    // any errors caused by failure of validations set in the model will be forwarded to the catch block below
    if (userDoc) {
      // payload cannot just be doc._id... must be an object, so you need a key as well
      const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
      // cookie maxAge == token expiry date, but in ms
      res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json(userDoc);
    } else {
      throw new Error("Unable to create new user.")
    }
  } catch(err) {
    next(err);
  };
});

/* log in existing user */
router.post("/log-in", async function(req, res, next) {
  const { username, password } = req.body;
  const lowercaseUsername = username.toLowerCase();

  try {
    const userDoc = await UserModel.findOne({ username: lowercaseUsername });
    // if the username matches...
    if (userDoc) {
      const authStatus = await bcrypt.compare(password, userDoc.password);
      // if the password matches...
      if (authStatus) {
        // create a token
        const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
        // send any data specifically with .json, NOT .send, otherwise res.json() parsing on front-end will result in invalid JSON
        res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true, secure: true }).json("Logged in.");
      } else {
        throw new Error("Passwords do not match.");
      };
    } else {
      throw new Error("Unable to find a matching username.")
    };
  } catch(err) {
    next(err);
  };
});

// logging out a user by storing current JWT on blacklist (client will redirect to log-in screen)
router.get("/log-out", async function(req, res, next) {
  const token = req.cookies.jwt;

  try {
    if (token) {
      const { exp } = await jwt.verify(token, process.env.JWT_SECRET);
      // storing a key-value pair consisting of an arbitrary (but unique) key name and the actual JWT token
      const key = `blacklist_${token}`;
      await redisClient.set(key, token);
      // specifying the expiry date of the key-value pair with the key name and the expiry date of the token itself
      redisClient.expireAt(key, exp);
      
      res.status(200).json("Logged out.");
    } else {
      throw new Error("No JWT found.");
    };
  } catch(err) {
    next(err);
  };  
});

module.exports = router;
