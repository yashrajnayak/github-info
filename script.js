const accessTokenInput = document.getElementById('accessToken');
const usernamesTextarea = document.getElementById('usernames');
const fetchButton = document.getElementById('fetchButton');
const resultsTable = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];

fetchButton.addEventListener('click', () => {
    const accessToken = accessTokenInput.value.trim();
    let usernames = usernamesTextarea.value.trim();

    // Check if usernames are comma-separated, if not, make them comma-separated
    if (!usernames.includes(',')) {
        usernames = usernames.split(/\s+/).join(',');
        usernamesTextarea.value = usernames; // Update textarea with comma-separated values
    }

    usernames = usernames.split(',').map(username => username.trim());

    resultsTable.innerHTML = ''; // Clear previous results

    if (!accessToken) {
        alert('Please enter a GitHub Personal Access Token');
        return;
    }

    // Update table header to include new columns
    const thead = document.querySelector('#resultsTable thead tr');
    thead.innerHTML = `
        <th>Username</th>
        <th>Stars</th>
        <th>Forks</th>
        <th>Repositories</th>
        <th>Followers</th>
        <th>Company</th>
        <th>Organizations</th>
    `;

    usernames.forEach((username, index) => {
        fetch(`https://api.github.com/users/${username}`, {
            headers: { Authorization: `token ${accessToken}` }
        })
            .then(response => response.json())
            .then(userData => {
                setTimeout(() => {
                    Promise.all([
                        fetch(`https://api.github.com/users/${username}/repos`, {
                            headers: { Authorization: `token ${accessToken}` }
                        }),
                        fetch(`https://api.github.com/users/${username}/orgs`, {
                            headers: { Authorization: `token ${accessToken}` }
                        })
                    ])
                        .then(([reposResponse, orgsResponse]) => 
                            Promise.all([reposResponse.json(), orgsResponse.json()])
                        )
                        .then(([reposData, orgsData]) => {
                            const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
                            const totalForks = reposData.reduce((sum, repo) => sum + repo.forks_count, 0);
                            const orgNames = orgsData.map(org => org.login).join(', ');

                            const row = resultsTable.insertRow();
                            row.innerHTML = `
                                <td>${username}</td>
                                <td>${totalStars}</td>
                                <td>${totalForks}</td>
                                <td>${reposData.length}</td>
                                <td>${userData.followers}</td>
                                <td>${userData.company || 'N/A'}</td>
                                <td>${orgNames || 'N/A'}</td>
                            `;
                        })
                        .catch(error => {
                            console.error('Error fetching data:', error);
                            // Handle fetch errors
                        });
                }, index * 1000);
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                // Handle user fetch errors
            });
    });
});
