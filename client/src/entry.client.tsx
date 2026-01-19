import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import Root from "./root";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
