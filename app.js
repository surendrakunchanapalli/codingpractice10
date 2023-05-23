const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3009, () => {
      console.log("Server Running at http://localhost:3009/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

/////authorization
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
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
// camel cases
const snakeToCamel1 = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

// camel cases
const snakeToCamel2 = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

/////////////////API 2 get state details
app.get("/states/", authenticateToken, async (request, response) => {
  const getCovidStates = `SELECT * FROM state;`;
  const statesList = await db.all(getCovidStates);
  const result = statesList.map((each) => snakeToCamel1(each));
  response.send(result);
});

//API 3 state details
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetails = `SELECT * FROM state where state_id = ${stateId};`;
  const state = await db.get(stateDetails);
  const result = snakeToCamel1(state);
  response.send(result);
});

//API 4 post district details

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
  const addDistrictQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5 district details
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = `SELECT * FROM district where district_id = ${districtId};`;
    const district = await db.get(districtDetails);
    const result = snakeToCamel2(district);
    response.send(result);
  }
);

// API 6  /districts/:districtId/
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictDetails = `DELETE FROM district where district_id = ${districtId};`;
    await db.run(deleteDistrictDetails);
    response.send("District Removed");
  }
);

/// 6 district details put
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
  UPDATE district  SET
         district_name = '${districtName}' , 
         state_id = ${stateId} , 
         cases = ${cases} ,
         cured = ${cured} ,
         active = ${active} ,
         deaths = ${deaths} 

   WHERE 
        district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
const snakeToCamel3 = (object) => {
  return {
    totalCases: object.cases,
    totalCured: object.cured,
    totalActive: object.active,
    totalDeaths: object.deaths,
  };
};
//7 API 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statesCovidDetails = `SELECT 
  SUM(cases) AS cases, 
  SUM(cured) AS cured, 
  SUM(active) AS active, 
  SUM(deaths) AS deaths 
  FROM district 
  WHERE 
  district.state_id = ${stateId};`;
    const dbResponse = await db.get(statesCovidDetails);
    const result = snakeToCamel3(dbResponse);
    response.send(result);
  }
);

// API 8 state name
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const stateDetails = `SELECT state_name FROM state JOIN district ON state.state_id = district.state_id WHERE district.district_id = ${districtId};`;
    const stateName = await db.get(stateDetails);
    response.send({ stateName: stateName.state_name });
  }
);

module.exports = app;
