const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.ObjectId,
        required: true,
    },
    senderId: {
        type: mongoose.ObjectId,
        required: true,
    },
    senderFullName: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    sent: {
        type: Date,
        required: true,
    },
    acknowledged: {
        type: Boolean,
        default: false,
        required: true,
    }
});

module.exports = mongoose.model("notification", NotificationSchema);