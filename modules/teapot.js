const teapot = (req, res) => {
  res.writeHead(418);
  res.end("I'm a teapot");
};

export default teapot;
