//localStorage.clear();

window.onload = displayHighScores;

document.getElementById("start-game").addEventListener("click", startGame);

if(localStorage.getItem('GameOver')==='1'){
    addHighScore(localStorage.getItem('PlayerName'), localStorage.getItem('Score'));
    localStorage.setItem('GameOver', '0');
}

function displayHighScores() {
    const highScoresList = document.getElementById('high-scores-list');
    const jsonData = JSON.parse(localStorage.getItem('HighScores')) || [];

    for (let i = 0; i < Math.min(jsonData.length, 3); i++) {
        const item = jsonData[i];
        const listItem = document.createElement('li');
        listItem.innerHTML = `${item.name} ${item.score}`;
        highScoresList.appendChild(listItem);
    }
}

function addHighScore(name, score) {
    const jsonData = JSON.parse(localStorage.getItem('HighScores')) || [];

    jsonData.push({ name, score });

    // Sort the array by score in descending order
    jsonData.sort((a, b) => b.score - a.score);

    // Keep only the top 10 scores
    const top10Scores = jsonData.slice(0, 10);

    // Save the updated data back to localStorage
    localStorage.setItem('HighScores', JSON.stringify(top10Scores));
}

function startGame() {
    localStorage.setItem('PlayerName', document.getElementById("name").value.toUpperCase());
    localStorage.setItem('Score', '0');
    localStorage.setItem('GameOver', '0');
    window.location.assign('./game.html');
}