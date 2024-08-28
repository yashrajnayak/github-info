document.addEventListener('DOMContentLoaded', function() {
    // DOM element selectors
    const accessTokenInput = document.getElementById('accessToken');
    const usernamesTextarea = document.getElementById('usernames');
    const fetchButton = document.getElementById('fetchButton');
    const copyTableButton = document.getElementById('copyTableButton');
    const resultsTable = document.getElementById('resultsTable');
    const progressContainer = document.getElementById('progressContainer');
    const fetchProgress = document.getElementById('fetchProgress');
    const progressText = document.getElementById('progressText');
    const failedUsernamesContainer = document.getElementById('failedUsernames');
    const failedUsernamesList = document.getElementById('failedUsernamesList');

    /**
     * Formats and cleans up a GitHub username
     * @param {string} input - The input username
     * @return {string} The formatted username
     */
    function formatUsername(input) {
        input = input.trim();
        // Remove GitHub URL if present
        input = input.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');
        // Remove trailing slash
        input = input.replace(/\/$/, '');
        // Remove @ sign if present
        input = input.replace('@', '');
        // Remove any non-alphanumeric characters except dash and underscore
        input = input.replace(/[^a-zA-Z0-9-_]/g, '');
        return input;
    }

    /**
     * Copies the table content to clipboard
     */
    function copyTableContent() {
        const rows = resultsTable.querySelectorAll('tr');
        let copyText = '';

        rows.forEach((row, index) => {
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

    // Add event listener to copy button if it exists
    if (copyTableButton) {
        copyTableButton.addEventListener('click', copyTableContent);
    }

    /**
     * Fetches GitHub data for the provided usernames
     */
    async function fetchGitHubData() {
        const accessToken = accessTokenInput.value.trim();
        let usernames = usernamesTextarea.value.trim().split(/[,\n\s]+/);
        usernames = usernames.map(formatUsername).filter(username => username !== '');
        usernamesTextarea.value = usernames.join('\n');

        // Clear previous results and reset UI
        const tableBody = resultsTable.querySelector('tbody');
        if (tableBody) {
            tableBody.innerHTML = ''; // Clear only the table body
        }
        if (copyTableButton) {
            copyTableButton.style.display = 'none';
        }
        if (failedUsernamesContainer) {
            failedUsernamesContainer.style.display = 'none';
        }
        if (failedUsernamesList) {
            failedUsernamesList.innerHTML = '';
        }

        if (!accessToken) {
            alert('Please enter a GitHub Personal Access Token');
            return;
        }

        // Show progress indicator
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        if (fetchProgress) {
            fetchProgress.value = 0;
        }
        if (progressText) {
            progressText.textContent = '0%';
        }

        let completedRequests = 0;
        const totalRequests = usernames.length;
        const failedUsernames = [];

        for (const username of usernames) {
            try {
                // Fetch user data
                const userData = await fetch(`https://api.github.com/users/${username}`, {
                    headers: { Authorization: `token ${accessToken}` }
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                });

                // Fetch repos and orgs data
                const [reposData, orgsData] = await Promise.all([
                    fetch(`https://api.github.com/users/${username}/repos`, {
                        headers: { Authorization: `token ${accessToken}` }
                    }).then(response => response.json()),
                    fetch(`https://api.github.com/users/${username}/orgs`, {
                        headers: { Authorization: `token ${accessToken}` }
                    }).then(response => response.json())
                ]);

                // Calculate total stars and forks
                const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
                const totalForks = reposData.reduce((sum, repo) => sum + repo.forks_count, 0);
                const orgNames = orgsData.map(org => org.login).join(', ');

                // Add row to the table
                const row = tableBody.insertRow(); // Insert row into table body
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
            } catch (error) {
                console.error(`Error fetching data for ${username}:`, error);
                failedUsernames.push(username);
            } finally {
                completedRequests++;
                updateProgress(completedRequests, totalRequests);
            }

            // Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Show copy button and hide progress indicator
        if (copyTableButton) {
            copyTableButton.style.display = 'block';
        }
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }

        // Display failed usernames if any
        if (failedUsernames.length > 0) {
            if (failedUsernamesContainer) {
                failedUsernamesContainer.style.display = 'block';
            }
            if (failedUsernamesList) {
                failedUsernamesList.innerHTML = '';
                failedUsernames.forEach(username => {
                    const li = document.createElement('li');
                    li.textContent = username;
                    failedUsernamesList.appendChild(li);
                });
            }
        } else {
            if (failedUsernamesContainer) {
                failedUsernamesContainer.style.display = 'none';
            }
        }
    }

    /**
     * Updates the progress bar and text
     * @param {number} completed - Number of completed requests
     * @param {number} total - Total number of requests
     */
    function updateProgress(completed, total) {
        const percentage = Math.round((completed / total) * 100);
        if (fetchProgress) {
            fetchProgress.value = percentage;
        }
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }

    // Add event listener to fetch button if it exists
    if (fetchButton) {
        fetchButton.addEventListener('click', fetchGitHubData);
    }
});
