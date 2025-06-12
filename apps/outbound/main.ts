export default {
  fetch: (req: Request) => {
    console.log("outbound", req.url);
    return fetch(req);
  },
};
