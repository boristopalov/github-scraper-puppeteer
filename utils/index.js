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
    searchCommitsForEmail: async function(url, auth) { 
        const res = await axios.get(
            url, { 
                'headers': {
                    'Authorization': `token ${auth}`,
                    "Content-Type": "application/json"
                }
            }).catch(e => console.error(e.response.data))

        const data = await res.data;
        for await (const e of data) { 
            if (e.hasOwnProperty('payload')) { 
                let payload = e.payload;
                if (payload.hasOwnProperty('commits')) { 
                    let commits = payload.commits;
                    if (commits && commits[0].hasOwnProperty('author')) { 

                        // 80-90% of these are personal emails
                        let author = commits[0].author;
                        // console.log(author.email);
                        return author.email;
                    }
                }
            }
        }   
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
