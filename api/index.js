const axios = require('axios').default;
const dotenv = require('dotenv').config();

const COMMITS_TOKEN = process.env.COMMITS_TOKEN;
const REPO_TOKEN = process.env.REPO_TOKEN;

module.exports = {
    // retrieves data on public events from github API and parses through it to look for an email
    // since we are communicating with github's REST api here we will use an auth token 
    // without a token: limit 60 requests per hour
    // with a token: limit 5,000 requests per hour 
    searchCommitsForEmail: async function(usernameToParse, nameToParse) { 
        const url = `https://api.github.com/users/${usernameToParse}/events/public`;
        const res = await axios.get(
            url, { 
                'headers': {
                    'Authorization': `token ${COMMITS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }).catch(error => { 
                console.error(error);
                return null;
            });

        const data = await res.data;
        // yikes 
        for await (const e of data) { 
            if (e.hasOwnProperty('payload')) { 
                let payload = e.payload;
                if (payload.hasOwnProperty('commits')) { 
                    let commits = payload.commits;
                    for (const c of commits) { 
                        if (c.hasOwnProperty('author')) { 
                            let author = c.author;
                            if (!author.email.includes('noreply') && (
                                author.name.split(' ').some(e => nameToParse.toLowerCase().includes(e.toLowerCase()) || usernameToParse.toLowerCase().includes(e.toLowerCase())))) { 
                                console.log(author.email);
                                return author.email || 'n/a';
                            }
                        }
                    }
                }
            }
        } 
        // we reach the end of the loop and there are no valid emails
        console.log('n/a'); 
        return 'n/a';  
    },
}