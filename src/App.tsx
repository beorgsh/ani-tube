import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import PlayerPage from "./pages/PlayerPage"; // Make sure to import this!
import Header from "./components/Header";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        {/* The Home component will render on the base URL "/" */}

        <Route path="/" element={<Home />} />

        {/* The PlayerPage component will render on "/watch/something" */}
        <Route path="/watch/:anime_session" element={<PlayerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
