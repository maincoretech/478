import logger from "../util/logger";
import "dotenv/config";

const delay = process.env.AUTH_DELAY * 3600000;

const tokenArr = [];
async function createToken(id) {
  let guid = "";
  for (let i = 32; i--; ) {
    const n = Math.floor(Math.random() * 16).toString(16);
    guid += n;
  }
  tokenArr[id] = {
    token: guid,
    expired: Date.now() + delay,
  };
  return guid;
}

async function verify(id, token) {
  let tmp = tokenArr[id];
  if (Date.now() >= tmp.expired) {
    localToken.delete(id);
    logger.info(`(#${id}) Token is out of date.Deleted.`);
    return false;
  } else if (token === tmp.token) {
    return true;
  } else {
    return false;
  }
}

export { createToken, verify };
