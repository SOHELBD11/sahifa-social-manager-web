const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();

const config = {
    user: "mseet_38568210",
    password: "OYVdlnpkhUzq",
    host: "ftpupload.net",
    port: 21,
    localRoot: __dirname + "/out",
    remoteRoot: "/htdocs",
    include: ["*", "**/*"],
    exclude: [
        "**/*.map",
        "node_modules/**",
        "node_modules/**/.*",
        ".git/**",
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false,
};

ftpDeploy
    .deploy(config)
    .then((res) => console.log("Deploy finished:", res))
    .catch((err) => console.log(err)); 