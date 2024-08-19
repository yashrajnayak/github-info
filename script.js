const usernamesTextarea = document.getElementById('usernames');
const fetchButton = document.getElementById('fetchButton');
const resultsTable = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];

fetchButton.addEventListener('click', () => {
    const usernames = usernamesTextarea.value.split(',').map(username => username.trim());

    resultsTable.innerHTML = ''; // Clear previous results

    usernames.forEach((username, index) => {
        // Fetch user data
        fetch(`https://api.github.com/users/${username}`)
            .then(response => response.json())
            .then(userData => {
                // Introduce a delay before fetching repository data
                setTimeout(() => {
                    fetch(`https://api.github.com/users/${username}/repos`)
                        .then(response => response.json())
                        .then(reposData => {
                            let totalStars = 0;
                            let totalForks = 0;
                            reposData.forEach(repo => {
                                totalStars += repo.stargazers_count;
                                totalForks += repo.forks_count;
                            });

                            const newRow = resultsTable.insertRow();
                            const cells = [
                                userData.login,
                                totalStars,
                                totalForks,
                                userData.public_repos,
                                userData.followers
                            ];

                            cells.forEach(cellData => {
                                const newCell = newRow.insertCell();
                                newCell.textContent = cellData;
                            });
                        })
                        .catch(error => {
                            console.error('Error fetching repository data:', error);
                            // Handle repository fetch errors (e.g., display an error message)
                        });
                }, index * 1000); // Delay based on the index of the username
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                // Handle user fetch errors (e.g., display an error message)
            });
    });
});
