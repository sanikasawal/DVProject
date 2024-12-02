const sharedState = {
    selectedGenre: null,
};

// Function to notify all charts about updates
function updateAllCharts() {
    const event = new Event("updateCharts");
    window.dispatchEvent(event);
}
