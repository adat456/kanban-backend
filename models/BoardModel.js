const mongoose = require("mongoose");

const SubTaskSchema = new mongoose.Schema({
    subtask: {
        type: String,
        maxLength: [50, "Maximum title length is 50 characters."],
        trim: true,
    },
    status: {
        type: Boolean,
        required: true,
        default: false,
    },
    // {userId, initials}
    completedBy: {
        type: Object
    }
});

const TaskSchema = new mongoose.Schema({
    task: {
        type: String,
        required: [true, "Please enter a title for this task."],
        maxLength: [30, "Maximum title length is 30 characters."],
        trim: true,
    },
    desc: {
        type: String,
        maxLength: [200, "Maximum description length is 200 characters."],
        trim: true,
    },
    subtasks: [SubTaskSchema],
    assignees: [{
        type: Object,
        ref: "user",
    }],
    created: {
        type: Date,  
    },
    deadline: {
        type: Date,
    },
    completed: {
        type: Date,
    }  
});

const ColumnSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        maxLength: [20, "Maximum length of column title is 20 characters."]
    },
    tasks: [TaskSchema],
});

const BoardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter a name for this board."],
        trim: true,
        maxLength: [20, "Maximum length of board title is 20 characters."],
    },
    creator: {
        type: mongoose.ObjectId,
        ref: "user",
        required: true
    },
    contributors: {
        // {userName, userId, userStatus}[]
        type: Array
    },
    columns: [ColumnSchema],
});

module.exports = mongoose.model("board", BoardSchema);