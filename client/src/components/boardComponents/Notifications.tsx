import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationInterface } from "../../Context";
import { fetchCatch, handleDisplayMsg } from "../helpers";

interface Prop {
    notifications: NotificationInterface[],
    setNotifications: React.Dispatch<React.SetStateAction<NotificationInterface[]>>,
    setNotificationsVis: React.Dispatch<React.SetStateAction<boolean>>,
};

const Notifications: React.FC<Prop> = function({ notifications, setNotifications, setNotificationsVis }) {
    const [ acknowledged, setAcknowledged ] = useState<string[]>([]);

    const navigate = useNavigate();
    
    function handleClick(notifId: string) {
        setAcknowledged([...acknowledged, notifId]);
        setNotifications(notifications.filter(notification => notification._id !== notifId));
    };
    function handleClearAllClick() {
        const remainingNotifIds = notifications.map(notif => notif._id);
        setAcknowledged([...acknowledged, ...remainingNotifIds]);
        setNotifications([]);
    };

    const notificationsArr = notifications.map(notif => {
        const year = notif.sent.slice(0, 4);
        const month = notif.sent.slice(5, 7);
        const day = notif.sent.slice(8, 10);
        const time = notif.sent.slice(11, 16);

        return (
            <div key={notif._id} className="notification">
                <div>
                    <p className="timestamp">{`${month}/${day}/${year}, ${time}`}</p>
                    <p>{notif.message}</p>
                </div>
                <button type="button" onClick={() => handleClick(notif._id)}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M21.2287 6.60355C21.6193 6.99407 21.6193 7.62723 21.2287 8.01776L10.2559 18.9906C9.86788 19.3786 9.23962 19.3814 8.84811 18.9969L2.66257 12.9218C2.26855 12.5349 2.26284 11.9017 2.64983 11.5077L3.35054 10.7942C3.73753 10.4002 4.37067 10.3945 4.7647 10.7815L9.53613 15.4677L19.1074 5.89644C19.4979 5.50592 20.1311 5.50591 20.5216 5.89644L21.2287 6.60355Z"/></svg>
                </button>
            </div>
        );
    });

    async function updateDBNotifications() {
        const reqOptions: RequestInit = {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(acknowledged),
            // indicates whether user should receive AND send cookies
            credentials: "include"
        };

        try {
            const req = await fetch("/api/acknowledge-notifications", reqOptions);
            // success or error message
            const res = await req.json();
            if (req.ok) {
                handleDisplayMsg(true, res);
            } else {
                throw new Error(res);
            }
        } catch(err) {
            fetchCatch(err, navigate);
        };
    };

    function handleNotificationsModal() {
        if (acknowledged.length > 0) updateDBNotifications();
        
        const notificationsModal: HTMLDialogElement | null = document.querySelector(".notifications-modal");
        notificationsModal?.close();

        setNotificationsVis(false);
    };

    return (
        <dialog className="notifications-modal">
            <header className="notifications-header">
                <h2>Notifications</h2>
                {notifications.length > 0 ?
                    <button type="button" onClick={handleClearAllClick}>
                        Clear all
                    </button> : null
                }
            </header>
            {notifications.length > 0 ? notificationsArr : <p id="no-notifs">No new notifications.</p>}
            <button className="close-modal" type="button" onClick={handleNotificationsModal}>
                <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
            </button>
        </dialog>
    );
};

export default Notifications;