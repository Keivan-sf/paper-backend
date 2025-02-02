const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const fsPromises = require("fs").promises;

async function handleLogin(req, res) {
  const usersDB = {
    users: JSON.parse(
      await fsPromises.readFile(`${__dirname}/${process.env.USERS_DB}`, "utf8")
    ),
    setUsers: function (data) {
      this.users = data;
    },
  };

  const { username, pass } = req.body;
  // check for empty inputs
  if (!username || !pass) {
    return res
      .status(400) // bad request
      .json({ message: "username and password are required" });
  }
  // check for user existance
  const foundUser = usersDB.users.find((user) => user.username === username);
  if (!foundUser) {
    return res
      .status(401) //Unauthorized
      .json({
        message: "user not found.",
      });
  }
  // evaluate password
  const isPassMatch = await bcrypt.compare(pass, foundUser.pass);
  if (isPassMatch) {
    // create jwt
    const accessToken = jwt.sign(
      { username: foundUser.username },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "2h" }
    );
    const refreshToken = jwt.sign(
      { username: foundUser.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "5d" }
    );

    console.log("authRefreshAG", refreshToken);

    // update database by adding refresh token to the currentUser
    const otherUsers = usersDB.users.filter(
      (user) => user.username !== foundUser.username
    );
    const currentUser = { ...foundUser, refreshToken };
    usersDB.setUsers([...otherUsers, currentUser].sort((a, b) => a.id - b.id));
    await fsPromises
      .writeFile(
        `${__dirname}/${process.env.USERS_DB}`,
        JSON.stringify(usersDB.users)
      )
      .then(() => {
        console.log("usersAfterRefreshUpdate", usersDB.users);
      });

    console.log("authRefreshBS", refreshToken);
    // send response
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 * 5,
      secure: true,
      sameSite: "None",
      domain: "paper.iran.liara.run",
    });

    res.json({
      accessToken,
    });
  } else {
    res
      .status(401) //Unauthorized
      .json({
        message: "wrong password.",
      });
  }
}

module.exports = { handleLogin };
