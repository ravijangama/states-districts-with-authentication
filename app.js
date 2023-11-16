const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server Is Starting @ 3000"));
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
//Validate User API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
         SELECT  *
         FROM user
         WHERE username="${username}";`;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPwdMatched = await bcrypt.compare(password, dbUser.password);
    if (isPwdMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfg");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfg", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
const convertDBToStatesList = (stateObj) => {
  return {
    stateId: stateObj.state_id,
    stateName: stateObj.state_name,
    population: stateObj.population,
  };
};
const convertDBToDistrictArray = (districtObj) => {
  return {
    districtId: districtObj.district_id,
    districtName: districtObj.district_name,
    stateId: districtObj.state_id,
    cases: districtObj.cases,
    cured: districtObj.cured,
    active: districtObj.active,
    deaths: districtObj.deaths,
  };
};
//Get All States API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
          SELECT 
              *
          FROM 
              state;`;
  const statesList = await db.all(getStatesQuery);
  response.send(
    statesList.map((eachState) => convertDBToStatesList(eachState))
  );
});
//Get Specific State API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
          SELECT 
              *
          FROM 
              state
          WHERE
              state_id=${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(convertDBToStatesList(state));
});
//Create A District API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
      INSERT INTO 
          district(district_name,state_id,cases,cured,active,deaths)
     VALUES(
         "${districtName}",
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
     );`;
  const newDistrict = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});
//Get Specific District API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
      SELECT
          *
      FROM
          district
      WHERE
          district_id=${districtId};`;
    const district = await db.get(districtQuery);
    response.send(convertDBToDistrictArray(district));
  }
);
//Delete District API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
       DELETE FROM
           district
       WHERE 
          district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
//Update District API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
      UPDATE 
          district
      SET
         district_name="${districtName}",
         state_id=${stateId},
         cases=${cases},
         cured=${cured},
         active=${active},
         deaths=${deaths}
    WHERE
         district_id=${districtId};`;
    const district = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
//Get Stats Of State API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
      SELECT 
         SUM(cases) AS totalCases ,
         SUM(cured) AS totalCured,
         SUM(active) AS totalActive, 
         SUM(deaths) AS totalDeaths 
     FROM 
        district
     WHERE
        state_id=${stateId};`;
    const covidStats = await db.get(statsQuery);
    response.send(covidStats);
  }
);
module.exports = app;
