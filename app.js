require("dotenv").config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

// setting up database connection
mongoose.set("strictQuery", false);
main().catch(err => console.log(err));
async function main() {
  await mongoose.connect(process.env.MONGOOSE_KEY);
  console.log("Connected to DB");
};

app.use(cors({credentials: true, origin: true}));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

// error handlers
function errorLogger(err, req, res, next) {
  // err.message pulls the actual error message, so that client receives a text statement instead of an empty object
  console.log(`Error: ${err.message}`);
  next(err);
};
function errorResponder(err, req, res, next) {
  const status = err.status || 404;
  res.status(status).json(err.message);
};
app.use(errorLogger);
app.use(errorResponder);

// invalid route handler (not an error handler)
// if client makes a fetch request to a route that does not exist
function invalidRoute(req, res, next) {
  res.status(404).send("Request made to invalid route.");
};
app.use(invalidRoute);

module.exports = app;
