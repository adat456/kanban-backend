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
    const userDoc = await UserModel.create({ firstName, lastName, username, password, email });
    // any errors caused by failure of validations set in the model will be forwarded to the catch block below
    if (userDoc) {
      // payload cannot just be doc._id... must be an object, so you need a key as well
      const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
      // maxAge of the cookie is equivalent to the expiry date of the token, but ms
      res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json(userDoc);
    } else {
      throw new Error("Unable to create new user.")
    }
  } catch(err) {
    // err.message pulls the actual error message, so that client receives a text statement instead of an empty object
    res.status(404).json(err.message);
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
        // pull all board data
        const populatedUserDoc = await userDoc.populate("boards");
        // and send the data specifically with .json, NOT .send, otherwise res.json() parsing on front-end will result in invalid JSON
        res.status(200).cookie("jwt", token, { maxAge: 86400000, httpOnly: true }).json(populatedUserDoc.boards);
      } else {
        throw new Error("Passwords do not match.");
      };
    } else {
      throw new Error("Unable to find a matching username.")
    };
  } catch(err) {
    res.status(404).json(err.message);
  };
});

// logging out a user by storing current JWT on blacklist (client will redirect to log-in screen)
router.get("/log-out", async function(req, res, next) {
  const token = req.cookies.jwt;
  const { exp } = await jwt.verify(token, process.env.JWT_SECRET);
  
  // storing a key-value pair consisting of an arbitrary (but unique) key name and the actual JWT token
  const key = `blacklist_${token}`;
  await redisClient.set(key, token);
  // specifying the expiry date of the key-value pair with the key name and the expiry date of the token itself
  redisClient.expireAt(key, exp);
  
  res.status(200).send("Logged out.");
});

module.exports = router;
