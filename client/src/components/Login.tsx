import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { handleDisplayMsg, validateCred, handleVisToggle } from "./helpers";

const Login: React.FC = function() {
    const [ username, setUsername ] = useState("");
    const [ usernameErr, setUsernameErr ] = useState("");
    const [ password, setPassword ] = useState("");
    const [ passwordErr, setPasswordErr ] = useState("");
    const [ displayMsg, setDisplayMsg ] = useState("");

    const location = useLocation();
    const navigate = useNavigate();

    // whenever login page is loaded, checks to see if there is any state with a log out msg
    // if so, display it in the dialog
    useEffect(() => {
        if (location.state) handleDisplayMsg(true, location.state.logOutMsg, setDisplayMsg);
    }, []);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const input = e.target;
        const field = e.target.getAttribute("id");
        if (field === "username") {
            validateCred(input, setUsernameErr);
            setUsername(input.value);
        };
        if (field === "password") {
            validateCred(input, setPasswordErr);
            setPassword(input.value);
        };
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const reqOptions: RequestInit = {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ username, password }),
            credentials: "include"
        };

        try {
            const res = await fetch("/api/users/log-in", reqOptions);
            // must parse the JSON error, because if the log in attempt failed, the returned JSON message contains the specific error message
            const message = await res.json();
            if (res.ok) {
                navigate("/boards", {state: {newUser: false}});
            } else {
                throw new Error(message);
            };
        } catch(err) {
            handleDisplayMsg(false, err.message, setDisplayMsg);
        };
    };

    return (
        <div className="login-page">
            <form method="POST" className="login-form" onSubmit={handleSubmit} noValidate>
                <svg className="logo" viewBox="0 0 153 26" xmlns="http://www.w3.org/2000/svg" aria-describedby="log-in-logo" aria-hidden="true" role="img"><title id="log-in-logo">Kanban logo atop login form</title><g fill="none" fillRule="evenodd"><path d="M44.56 25v-5.344l1.92-2.112L50.928 25h5.44l-6.304-10.432 6.336-7.04h-5.92l-5.92 6.304V.776h-4.8V25h4.8Zm19.36.384c2.176 0 3.925-.672 5.248-2.016V25h4.48V13.48c0-1.259-.315-2.363-.944-3.312-.63-.95-1.51-1.69-2.64-2.224-1.13-.533-2.432-.8-3.904-.8-1.856 0-3.483.427-4.88 1.28-1.397.853-2.352 2.005-2.864 3.456l3.84 1.824a4.043 4.043 0 0 1 1.424-1.856c.65-.47 1.403-.704 2.256-.704.896 0 1.605.224 2.128.672.523.448.784 1.003.784 1.664v.48l-4.832.768c-2.09.341-3.648.992-4.672 1.952-1.024.96-1.536 2.176-1.536 3.648 0 1.579.55 2.816 1.648 3.712 1.099.896 2.587 1.344 4.464 1.344Zm.96-3.52c-.597 0-1.099-.15-1.504-.448-.405-.299-.608-.715-.608-1.248 0-.576.181-1.019.544-1.328.363-.31.885-.528 1.568-.656l3.968-.704v.544c0 1.067-.363 1.973-1.088 2.72-.725.747-1.685 1.12-2.88 1.12ZM81.968 25V14.792c0-1.003.299-1.808.896-2.416.597-.608 1.365-.912 2.304-.912.939 0 1.707.304 2.304.912.597.608.896 1.413.896 2.416V25h4.8V13.768c0-1.323-.277-2.48-.832-3.472a5.918 5.918 0 0 0-2.32-2.32c-.992-.555-2.15-.832-3.472-.832-1.11 0-2.09.208-2.944.624a4.27 4.27 0 0 0-1.952 1.904V7.528h-4.48V25h4.8Zm24.16.384c1.707 0 3.232-.405 4.576-1.216a8.828 8.828 0 0 0 3.184-3.296c.779-1.387 1.168-2.923 1.168-4.608 0-1.707-.395-3.248-1.184-4.624a8.988 8.988 0 0 0-3.2-3.28c-1.344-.81-2.848-1.216-4.512-1.216-2.112 0-3.787.619-5.024 1.856V.776h-4.8V25h4.48v-1.664c.619.661 1.392 1.168 2.32 1.52a8.366 8.366 0 0 0 2.992.528Zm-.576-4.32c-1.301 0-2.363-.443-3.184-1.328-.821-.885-1.232-2.043-1.232-3.472 0-1.408.41-2.56 1.232-3.456.821-.896 1.883-1.344 3.184-1.344 1.323 0 2.41.453 3.264 1.36.853.907 1.28 2.053 1.28 3.44 0 1.408-.427 2.56-1.28 3.456-.853.896-1.941 1.344-3.264 1.344Zm17.728 4.32c2.176 0 3.925-.672 5.248-2.016V25h4.48V13.48c0-1.259-.315-2.363-.944-3.312-.63-.95-1.51-1.69-2.64-2.224-1.13-.533-2.432-.8-3.904-.8-1.856 0-3.483.427-4.88 1.28-1.397.853-2.352 2.005-2.864 3.456l3.84 1.824a4.043 4.043 0 0 1 1.424-1.856c.65-.47 1.403-.704 2.256-.704.896 0 1.605.224 2.128.672.523.448.784 1.003.784 1.664v.48l-4.832.768c-2.09.341-3.648.992-4.672 1.952-1.024.96-1.536 2.176-1.536 3.648 0 1.579.55 2.816 1.648 3.712 1.099.896 2.587 1.344 4.464 1.344Zm.96-3.52c-.597 0-1.099-.15-1.504-.448-.405-.299-.608-.715-.608-1.248 0-.576.181-1.019.544-1.328.363-.31.885-.528 1.568-.656l3.968-.704v.544c0 1.067-.363 1.973-1.088 2.72-.725.747-1.685 1.12-2.88 1.12ZM141.328 25V14.792c0-1.003.299-1.808.896-2.416.597-.608 1.365-.912 2.304-.912.939 0 1.707.304 2.304.912.597.608.896 1.413.896 2.416V25h4.8V13.768c0-1.323-.277-2.48-.832-3.472a5.918 5.918 0 0 0-2.32-2.32c-.992-.555-2.15-.832-3.472-.832-1.11 0-2.09.208-2.944.624a4.27 4.27 0 0 0-1.952 1.904V7.528h-4.48V25h4.8Z" fill="#000112" fillRule="nonzero"/><g transform="translate(0 1)" fill="#635FC7"><rect width="6" height="25" rx="2"/><rect opacity=".75" x="9" width="6" height="25" rx="2"/><rect opacity=".5" x="18" width="6" height="25" rx="2"/></g></g></svg>
                <h2>Welcome back.</h2>
                <label htmlFor="username">Username</label>
                <input type="text" name="username" id="username" value={username} onChange={handleChange} required maxLength={15} />
                <p className="err-msg">{usernameErr}</p>
                <label htmlFor="password">Password</label>
                <div className="password-field-set">
                    <input type="password" name="password" id="password" value={password} onChange={handleChange} required maxLength={15} />
                    <button type="button" data-id="password" onClick={handleVisToggle} title="Toggle password visibility">
                        <svg aria-hidden="true" focusable="false" viewBox="0 0 16 11" xmlns="http://www.w3.org/2000/svg"><path d="M15.815 4.434A9.055 9.055 0 0 0 8 0 9.055 9.055 0 0 0 .185 4.434a1.333 1.333 0 0 0 0 1.354A9.055 9.055 0 0 0 8 10.222c3.33 0 6.25-1.777 7.815-4.434a1.333 1.333 0 0 0 0-1.354ZM8 8.89A3.776 3.776 0 0 1 4.222 5.11 3.776 3.776 0 0 1 8 1.333a3.776 3.776 0 0 1 3.778 3.778A3.776 3.776 0 0 1 8 8.89Zm2.889-3.778a2.889 2.889 0 1 1-5.438-1.36 1.19 1.19 0 1 0 1.19-1.189H6.64a2.889 2.889 0 0 1 4.25 2.549Z" /></svg>
                        <span className="sr-only">Toggle password visibility</span>
                    </button>
                </div>
                <p className="err-msg">{passwordErr}</p>
                <button type="submit" className="save-btn">Log in</button>
                <p className="redirect">Don't have an account yet? <a href="/sign-up" onClick={() => navigate("/sign-up")}>Sign up</a></p>
            </form>
            <dialog className="display-msg-modal">
                <p>{displayMsg}</p>
            </dialog>
        </div>
    );
};

export default Login;