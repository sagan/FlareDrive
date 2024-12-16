import React from "react";
import { redirect } from "react-router";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css"

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
    loader: function ({ request }) {
      const url = new URL(request.url)
      if (!url.pathname.endsWith("/")) {
        return redirect(url.pathname + "/")
      }
      return {}
    }
  },
]);

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
