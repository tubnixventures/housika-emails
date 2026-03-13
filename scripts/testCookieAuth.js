import fetch from "node-fetch";

(async () => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbi10ZXN0Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzczMzkyMTE5LCJleHAiOjE3NzMzOTU3MTl9.Jrc1b9LV0KeYeaNQqbQarw-Ur5E2TDYom7nNcju6teE";

  const res = await fetch("http://localhost:3000/emails", {
    headers: {
      Cookie: `token=${token}`,
    },
  });

  console.log("status", res.status);
  console.log(await res.text());
})();
