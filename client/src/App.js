import "./App.css";
import { useState } from "react";
import axios from "axios";

function App() {
  const [profileInput, setProfileInput] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [repoInput, setRepoInput] = useState("");

  const headers = {
    "Access-Control-Allow-Origin": "*",
  };

  const handleProfileChange = (event) => {
    setProfileInput(event.target.value);
  };
  const handleOrgChange = (event) => {
    setOrgInput(event.target.value);
  };
  const handleRepoChange = (event) => {
    setRepoInput(event.target.value);
  };

  const scrapeProfile = async (event) => {
    event.preventDefault();
    console.log(profileInput);
    const { data } = await axios.get(
      `http://localhost:8080/following/${profileInput}`,
      { headers }
    );
    console.log(profileInput);
  };

  const scrapeOrg = async (event) => {
    event.preventDefault();
    const { data } = await axios.get(`http://localhost:8080/org/${orgInput}`);
    console.log(orgInput);
  };

  const scrapeRepo = async (event) => {
    event.preventDefault();
    const { data } = await axios.get(`http://localhost:8080/repo/${repoInput}`);
    console.log(repoInput);
  };

  return (
    <div className="App">
      <form>
        <input type="text" id="profileUrl" onChange={handleProfileChange} />
        <button onClick={scrapeProfile}> Scrape Profile </button>
      </form>

      <form>
        <input type="text" id="orgUrl" onChange={handleOrgChange} />
        <button onClick={scrapeOrg}> Scrape Org </button>
      </form>
      <form>
        <input type="text" id="orgUrl" onChange={handleRepoChange} />
        <button onClick={scrapeRepo}> Scrape Repo </button>
      </form>
    </div>
  );
}

export default App;
