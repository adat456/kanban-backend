var express = require("express");
var router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const UserModel = require("../models/UserModel");

/* create a new user */
router.post("/sign-up", async function(req, res, next) {
  const { firstName, lastName, username, password, email } = req.body;

  try {
    const doc = await UserModel.create({ firstName, lastName, username, password, email });
    // any errors caused by failure of validations set in the model will be forwarded to the catch block below
    if (doc) {
      // payload cannot just be doc._id... must be an object, so you need a key as well
      const token = jwt.sign({ id: doc._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
      // maxAge of the cookie is equivalent to the expiry date of the token, but ms
      res.status(200).cookie("jwt", token, { maxAge: 86400000, httpsOnly: true }).json("New user created.");
    } else {
      throw new Error("Unable to create new user.")
    }
  } catch(err) {
    // err.message pulls the actual error message, so that client receives a text statement instead of an empty object
    res.status(404).send(err.message);
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
      console.log(authStatus);
      // if the password matches...
      if (authStatus) {
        // create a token
        const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
        // pull all board data
        const populatedUserDoc = await userDoc.populate("boards");
        console.log(populatedUserDoc.boards);
        // and send it
        res.status(200).cookie("jwt", token, { maxAge: 86400000, httpsOnly: true }).json(populatedUserDoc.boards);
      } else {
        throw new Error("Passwords do not match.");
      };
    } else {
      throw new Error("Unable to find a matching username.")
    };
  } catch(err) {
    res.status(404).send(err.message);
  };
});

/* log out user */
router.get("/log-out", function(req, res, next) {
  res.status(200).cookie("jwt", "", { maxAge: 1 }).send("Logged out.");
});

module.exports = router;
