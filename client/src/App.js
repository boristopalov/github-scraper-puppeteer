import "./App.css";
import { useState } from "react";
import axios from "axios";
import { Oval } from "react-loader-spinner";

function App() {
  const [profileInput, setProfileInput] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [profileDataIsLoaded, setProfileDataIsLoaded] = useState(null);
  const [orgDataIsLoaded, setOrgDataIsLoaded] = useState(null);
  const [repoDataIsLoaded, setRepoDataIsLoaded] = useState(null);

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

  const downloadData = (data) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrapeProfile = async (event) => {
    event.preventDefault();
    setProfileDataIsLoaded(false);
    // console.log(profileInput);
    const res = await axios
      .get(`http://localhost:8080/following/${profileInput}`, { headers })
      .catch((error) => {
        if (error.response.status === 404) {
          console.log(error.response);
          setProfileDataIsLoaded(true);
        }
      });
    downloadData(res.data);
    setProfileDataIsLoaded(true);
  };

  const scrapeOrg = async (event) => {
    event.preventDefault();
    setOrgDataIsLoaded(false);
    const res = await axios
      .get(`http://localhost:8080/org/${orgInput}`, { headers })
      .catch((error) => {
        if (error.response.status === 404) {
          console.log(error.response);
          setProfileDataIsLoaded(true);
        }
      });
    downloadData(res.data);
    setOrgDataIsLoaded(true);
  };

  const scrapeRepo = async (event) => {
    event.preventDefault();
    setRepoDataIsLoaded(false);
    const res = await axios
      .get(`http://localhost:8080/repo/${repoInput}`, { headers })
      .catch((error) => {
        if (error.response.status === 404) {
          console.log(error.response);
          setProfileDataIsLoaded(true);
        }
      });
    downloadData(res.data);
    setRepoDataIsLoaded(true);
  };

  // useEffect(() => {
  //   effect
  //   return () => {
  //     cleanup
  //   }
  // }, [profileDataIsLoaded, orgDataIsLoaded, repoDataIsLoaded])

  return (
    <div className="App">
      <div>
        <form>
          <input type="text" id="profileUrl" onChange={handleProfileChange} />
          <button onClick={scrapeProfile}> Scrape Profile </button>
        </form>
        {profileDataIsLoaded === false ? <Oval height={40} width={40} /> : null}
      </div>

      <div>
        <form>
          <input type="text" id="orgUrl" onChange={handleOrgChange} />
          <button onClick={scrapeOrg}> Scrape Org </button>
        </form>
        {!orgDataIsLoaded === false ? <Oval height={40} width={40} /> : null}
      </div>

      <div>
        <form>
          <input type="text" id="orgUrl" onChange={handleRepoChange} />
          <button onClick={scrapeRepo}> Scrape Repo </button>
        </form>
        {!repoDataIsLoaded === false ? <Oval height={40} width={40} /> : null}
      </div>
    </div>
  );
}

export default App;
