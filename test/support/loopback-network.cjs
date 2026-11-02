// E2E-only workaround: some headless containers return ENOSYS/EAFNOSUPPORT
// from libuv's interface enumeration even though 127.0.0.1 is usable.
// Never loaded by the production Worker or deployment builds.
const os = require("node:os");
const original = os.networkInterfaces.bind(os);
os.networkInterfaces = () => {
  try {
    return original();
  } catch (error) {
    if (error && error.code === "ERR_SYSTEM_ERROR" &&
        error.info && error.info.errno === 97) {
      return {
        lo: [{
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        }],
      };
    }
    throw error;
  }
};
