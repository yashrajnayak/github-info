const accessTokenInput = document.getElementById('accessToken');
const usernamesTextarea = document.getElementById('usernames');
const fetchButton = document.getElementById('fetchButton');
const copyTableButton = document.getElementById('copyTableButton');
const resultsTable = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
const progressContainer = document.getElementById('progressContainer');
const fetchProgress = document.getElementById('fetchProgress');
const progressText = document.getElementById('progressText');

// Function to format and clean up usernames
function formatUsername(input) {
    // Remove leading/trailing whitespace
    input = input.trim();

    // Remove 'https://github.com/' or 'github.com/' if present
    input = input.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');

    // Remove any trailing slash
    input = input.replace(/\/$/, '');

    // Remove any email addresses
    if (input.includes('@')) {
        return '';
    }

    // Remove any non-alphanumeric characters except dash and underscore
    input = input.replace(/[^a-zA-Z0-9-_]/g, '');

    return input;
}

// Function to copy table content
function copyTableContent() {
    const table = document.getElementById('resultsTable');
    const rows = table.querySelectorAll('tr');
    let copyText = '';

    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const rowData = Array.from(cells).map(cell => cell.textContent.trim());
        copyText += rowData.join('\t') + '\n';
    });

    navigator.clipboard.writeText(copyText).then(() => {
        alert('Table copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy table: ', err);
        alert('Failed to copy table. Please try again.');
    });
}

// Add event listener to copy button
copyTableButton.addEventListener('click', copyTableContent);

fetchButton.addEventListener('click', () => {
    const accessToken = accessTokenInput.value.trim();
    let usernames = usernamesTextarea.value.trim();

    // Split usernames by commas, newlines, or spaces
    usernames = usernames.split(/[,\n\s]+/);

    // Format and filter usernames
    usernames = usernames.map(formatUsername).filter(username => username !== '');

    // Update textarea with formatted usernames
    usernamesTextarea.value = usernames.join('\n');

    resultsTable.innerHTML = ''; // Clear previous results
    copyTableButton.style.display = 'none'; // Hide copy button initially

    if (!accessToken) {
        alert('Please enter a GitHub Personal Access Token');
        return;
    }

    progressContainer.style.display = 'block';
    fetchProgress.value = 0;
    progressText.textContent = '0%';

    let completedRequests = 0;
    const totalRequests = usernames.length;

    const fetchPromises = usernames.map((username, index) => 
        new Promise((resolve, reject) => {
            setTimeout(() => {
                fetch(`https://api.github.com/users/${username}`, {
                    headers: { Authorization: `token ${accessToken}` }
                })
                    .then(response => response.json())
                    .then(userData => {
                        return Promise.all([
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
                                    <td>${userData.name || 'N/A'}</td>
                                    <td>${totalStars}</td>
                                    <td>${totalForks}</td>
                                    <td>${reposData.length}</td>
                                    <td>${userData.followers}</td>
                                    <td>${userData.company || 'N/A'}</td>
                                    <td>${orgNames || 'N/A'}</td>
                                `;

                                completedRequests++;
                                updateProgress(completedRequests, totalRequests);
                                resolve();
                            });
                    })
                    .catch(error => {
                        console.error(`Error fetching data for ${username}:`, error);
                        completedRequests++;
                        updateProgress(completedRequests, totalRequests);
                        reject(error);
                    });
            }, index * 1000);
        })
    );

    Promise.all(fetchPromises)
        .then(() => {
            copyTableButton.style.display = 'block';
            progressContainer.style.display = 'none';
        })
        .catch(error => {
            console.error('Error fetching all data:', error);
            copyTableButton.style.display = 'block';
            progressContainer.style.display = 'none';
        });
});

function updateProgress(completed, total) {
    const percentage = Math.round((completed / total) * 100);
    fetchProgress.value = percentage;
    progressText.textContent = `${percentage}%`;
}
