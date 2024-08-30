const date = () => {
  return (
    "[" +
    new Intl.DateTimeFormat("zh", { dateStyle: "short" }).format() +
    "#" +
    new Intl.DateTimeFormat("zh", { timeStyle: "long" }).format() +
    "]"
  );
};

const logger = {
  info: (s) => {
    console.log(date() + "\x1b[32m[INFO]\x1b[0m " + s);
  },
  warn: (s) => {
    console.warn(date() + "\x1b[33m[WARN]\x1b[0m " + s);
  },
  error: (s) => {
    console.error(date() + "\x1b[31m[ERROR]\x1b[0m " + s);
  },
};

export default logger;
