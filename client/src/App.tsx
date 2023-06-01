import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./components/Login";
import Signup from "./components/Signup";
import AllBoards from "./components/AllBoards";

const App: React.FC = function() {
  return (
    <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/log-in" element={<Login />} />
            <Route path="/sign-up" element={<Signup />} />
            <Route path="/boards" element={<AllBoards />} />
          </Routes>
        </BrowserRouter>
        <dialog className="display-msg-modal" />
    </div>
  );
};

export default App;
