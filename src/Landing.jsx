import React from "react";

export default function Landing() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#0F2E1E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
        padding: 0,
      }}
    >
      <img
        src="/og-image.png"
        alt="MIB.is"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "1200px",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
