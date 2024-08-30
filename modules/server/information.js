import "dotenv/config";

const config = process.env;

const information = (req, res) => {
  let resp = {
    status: true,
    message: "",
    data: {
      server: {
        name: config.SERVER_NAME,
      },
    },
  };
  res.status(200);
  res.send(resp);
};

export default information;
