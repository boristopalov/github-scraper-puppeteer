const axios = require('axios').default;

module.exports = {

    // i didn't use this 
    searchTextForKeywords: function (text, keywords) { 
        return keywords.some(keyword => text.includes(keyword))
    },

    // probably a better way to do this  
    getFilteredBio: async function(data, keywords) { 
        let dataCopy = await data.filter(element => searchTextForKeywords(element.bio, keywords) === true);
        return dataCopy;
    },

    getFilteredLocation: async function(data, keywords) { 
        let dataCopy = await data.filter(element => searchTextForKeywords(element.location, keywords) === true);
        return dataCopy;
    },

    // since we are communicating with github's REST api here we will use an auth token 
    // without a token: limit 60 requests per hour
    // with a token: limit 5,000 requests per hour 
    searchCommitsForEmail: async function(usernameToParse, nameToParse, auth) { 
        const url = `https://api.github.com/users/${usernameToParse}/events/public`;
        const res = await axios.get(
            url, { 
                'headers': {
                    'Authorization': `token ${auth}`,
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
                                return author.email;
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

    // convert an array of objects to a csv-formatted string
    arrayOfObjectsToCSV: function(arr) {
        const csvString = [
            [
            'Name',
            'Email',
            'Username',
            'Company',
            'Location',
            'Bio',
            ],
            ...arr.map(e => [
            e.name.replaceAll(',', ''),
            e.email,
            e.username,
            e.company.replaceAll(',', ';'),
            e.location.replaceAll(',', ''),
            e.bio.replaceAll('\n', '').replaceAll(',', ';')
            ])
        ].map((item) => item.join(',')).join('\n');
        return csvString;
    },
};
