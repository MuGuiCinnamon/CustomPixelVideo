let video, bgm; // Video and background music elements
let inputText = ""; // Original text content
let mode1 = "menu"; // Main mode: menu, videoMenu
let mode2 = "mv"; // Sub mode: mv, narration
let uiVisible = true; // UI visibility control
let synth; // Tone.js synthesizer
let textLoaded = false; // Text loading status
let paused = false; // Pause status

let textSegments = []; // Store all text segments
let currentSegmentIndex = 0; // Current segment index
let narrationPlaying = false; // Voice narration status
let speechSynthesis; // Speech synthesis API

let progressBar = { // Progress bar properties
  x: 0, 
  y: 0, 
  width: 0, 
  height: 8,
  handleRadius: 12, 
  dragging: false, 
  visible: false
};

let searchInput; // Search input element
let searchResults = new Set(); // Store unique search terms
let currentSearchTerm = ""; // Current search term
let searchActive = false; // Search active status
let highlightedWords = new Set(); // Store highlighted words

// Load all assets before setup
async function preload() {
  video = createVideo("assets/video.mp4");
  video.hide();
  inputText = await loadStrings("assets/text.txt");
  bgm = createAudio("assets/audio.mp3");
  loadSearchHistory();
}

// Initialize canvas and setup components
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Georgia");
  textAlign(CENTER, CENTER);
  fill(255);
  noStroke();

  inputText = inputText.join("\n");
  parseTextSegments(inputText);
  console.log("Parsed segments:", textSegments);
  
  // Initialize audio synthesizer
  synth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { 
    attack: 0.05, 
    decay: 0.1, 
    sustain: 0.2, 
    release: 0.4 
    }
  }).toDestination();

  speechSynthesis = window.speechSynthesis;

  // UI button events
  select("#startBtn").mousePressed(() => startMV());
  select("#switchBtn").mousePressed(() => switchMode());
  
  createSearchUI();
  
  // Video end event handler
  video.elt.onended = () => {
    stopPlayback();
    mode1 = "menu";
    uiVisible = true;
    paused = false;
    progressBar.visible = false;
    select("#ui").style("display", "block");
    showSearchUI();

    background(0);
    fill(255);
    textSize(28);
    text("Video ended. Returning to menu...", width / 2, height / 2);
    setTimeout(() => drawUIText(), 2000);
  };
  
  updateProgressBarPosition();
}

// Create search interface components
function createSearchUI() {
  let searchContainer = createDiv('');
  searchContainer.id('search-container');
  searchContainer.style('position', 'absolute');
  searchContainer.style('top', '20px');
  searchContainer.style('left', '50%');
  searchContainer.style('transform', 'translateX(-50%)');
  searchContainer.style('z-index', '1000');
  searchContainer.style('display', 'none');
  
  searchInput = createInput('');
  searchInput.parent(searchContainer);
  searchInput.attribute('placeholder', 'Search for a full word or phrase...');
  searchInput.style('padding', '10px');
  searchInput.style('width', '300px');
  searchInput.style('border', '2px solid #fff');
  searchInput.style('background', 'rgba(0,0,0,0.8)');
  searchInput.style('color', '#fff');
  searchInput.style('border-radius', '5px');
  searchInput.style('font-size', '16px');
  
  let searchButton = createButton('Search');
  searchButton.parent(searchContainer);
  searchButton.style('padding', '10px 20px');
  searchButton.style('margin-left', '10px');
  searchButton.style('border', '2px solid #fff');
  searchButton.style('background', 'rgba(0,0,0,0.8)');
  searchButton.style('color', '#fff');
  searchButton.style('border-radius', '5px');
  searchButton.style('cursor', 'pointer');
  searchButton.style('font-size', '16px');
  
  let clearButton = createButton('Clear');
  clearButton.parent(searchContainer);
  clearButton.style('padding', '10px 20px');
  clearButton.style('margin-left', '10px');
  clearButton.style('border', '2px solid #fff');
  clearButton.style('background', 'rgba(62, 59, 59, 0.8)');
  clearButton.style('color', '#fff');
  clearButton.style('border-radius', '5px');
  clearButton.style('cursor', 'pointer');
  clearButton.style('font-size', '16px');
  
  let historyContainer = createDiv('');
  historyContainer.parent(searchContainer);
  historyContainer.id('history-container');
  historyContainer.style('margin-top', '10px');
  historyContainer.style('color', '#fff');
  historyContainer.style('font-size', '14px');
  
  // Event listeners
  searchButton.mousePressed(() => performSearch());
  clearButton.mousePressed(() => clearCurrentSearch());
  searchInput.changed(() => performSearch());
  
  searchInput.elt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
    else if (e.key === 'Escape') clearCurrentSearch();
  });
  
  updateSearchHistoryDisplay();
}

// Update search history display
function updateSearchHistoryDisplay() {
  let historyContainer = select('#history-container');
  if (!historyContainer) return;
  
  if (highlightedWords.size > 0) {
    let historyText = 'Highlighted words:';
    highlightedWords.forEach(word => {
      historyText += `<span style="color: red; margin: 0 5px;">${word}</span>`;
    });
    historyText += ` <button id="clear-all-btn" style="margin-left: 10px; padding: 5px 10px; border: 1px solid #fff; background: rgba(255,0,0,0.3); color: #fff; border-radius: 3px; cursor: pointer;">Clear all</button>`;
    historyContainer.html(historyText);
    select('#clear-all-btn').mousePressed(() => clearAllHighlights());
  } else {
    historyContainer.html('No highlighted words yet');
  }
}

// Perform search operation
function performSearch() {
  const searchTerm = searchInput.value().trim();
  if (searchTerm === '') {
    clearCurrentSearch();
    return;
  }
  
  currentSearchTerm = searchTerm;
  searchActive = true;
  const wordRegex = new RegExp(`\\b${escapeRegExp(searchTerm)}\\b`, 'gi');
  const matches = inputText.match(wordRegex);
  
  if (matches && matches.length > 0) {
    highlightedWords.add(searchTerm.toLowerCase());
    saveSearchHistory();
    console.log(`Found ${matches.length} exact matches: "${searchTerm}"`);
  } else {
    console.log(`No exact matches found: "${searchTerm}"`);
  }
  updateSearchHistoryDisplay();
}

// Escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if word should be highlighted
function shouldHighlightWord(word) {
  if (!highlightedWords.size) return false;
  return highlightedWords.has(word.toLowerCase());
}

// Clear current search
function clearCurrentSearch() {
  searchInput.value('');
  currentSearchTerm = "";
  searchActive = false;
  console.log('Current search cleared');
}

// Clear all highlighted words
function clearAllHighlights() {
  highlightedWords.clear();
  searchResults.clear();
  currentSearchTerm = "";
  searchActive = false;
  searchInput.value('');
  localStorage.removeItem('videoTextHighlights');
  console.log('All highlights cleared');
  updateSearchHistoryDisplay();
}

// Save search history to localStorage
function saveSearchHistory() {
  const historyArray = Array.from(highlightedWords);
  localStorage.setItem('videoTextHighlights', JSON.stringify(historyArray));
  console.log('Search history saved:', historyArray);
}

// Load search history from localStorage
function loadSearchHistory() {
  const savedHistory = localStorage.getItem('videoTextHighlights');
  if (savedHistory) {
    const historyArray = JSON.parse(savedHistory);
    highlightedWords = new Set(historyArray);
    console.log('Search history loaded:', historyArray);
  }
}

// Show search UI
function showSearchUI() {
  if (select('#search-container')) {
    select('#search-container').style('display', 'block');
    updateSearchHistoryDisplay();
  }
}

// Hide search UI
function hideSearchUI() {
  if (select('#search-container')) {
    select('#search-container').style('display', 'none');
  }
}

// Update progress bar position based on window size
function updateProgressBarPosition() {
  progressBar.width = width * 0.8;
  progressBar.x = width * 0.1;
  progressBar.y = height * 0.9;
}

// Handle window resize
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateProgressBarPosition();
}

// Parse text into timed segments
function parseTextSegments(fullText) {
  textSegments = [];
  const lines = fullText.split('\n');
  let currentTime = 0;
  let currentTitle = "";
  let currentContent = "";
  let inSegment = false;
  
  for (let line of lines) {
    const timeMatch = line.match(/\[(\d+):(\d+)\](.*)/);
    if (timeMatch) {
      if (inSegment) {
        textSegments.push({
          time: currentTime,
          timeStr: `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')}`,
          title: currentTitle.trim(),
          content: currentContent.trim()
        });
        currentContent = "";
      }
      const minutes = parseInt(timeMatch[1]);
      const seconds = parseInt(timeMatch[2]);
      currentTime = minutes * 60 + seconds;
      currentTitle = timeMatch[3] || "";
      inSegment = true;
    } else if (inSegment) {
      currentContent += line + '\n';
    }
  }
  
  if (inSegment && currentContent) {
    textSegments.push({
      time: currentTime,
      timeStr: `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')}`,
      title: currentTitle.trim(),
      content: currentContent.trim()
    });
  }
  
  if (textSegments.length === 0) {
    textSegments.push({
      time: 0, 
      timeStr: "0:00", 
      title: "Default Segment", 
      content: fullText
    });
  }
  console.log(`Parsed: ${textSegments.length} segments`);
}

// Get current text based on video time
function getCurrentText() {
  if (!video || textSegments.length === 0) {
    console.log("No video or segments available");
    return inputText;
  }
  
  const currentTime = video.time();
  let selectedSegment = textSegments[0];
  
  for (let i = textSegments.length - 1; i >= 0; i--) {
    if (currentTime >= textSegments[i].time) {
      selectedSegment = textSegments[i];
      if (i !== currentSegmentIndex) {
        currentSegmentIndex = i;
        console.log(`Switched to segment: [${selectedSegment.timeStr}] ${selectedSegment.title}`);
        if (mode2 === "narration" && narrationPlaying) {
          speakCurrentSegment();
        }
      }
      break;
    }
  }
  return selectedSegment.content || inputText;
}

// Speak current text segment
function speakCurrentSegment() {
  if (!speechSynthesis || textSegments.length === 0) {
    console.log("Speech synthesis not available");
    return;
  }
  
  speechSynthesis.cancel();
  const currentSegment = textSegments[currentSegmentIndex];
  if (currentSegment && currentSegment.content) {
    const utterance = new SpeechSynthesisUtterance(currentSegment.content);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      utterance.voice = englishVoice || voices[0];
    }
    
    utterance.onerror = function(event) {
      console.error('Speech synthesis error:', event.error);
    };
    
    utterance.onend = function() {
      console.log('Speech playback ended');
    };
    
    try {
      speechSynthesis.speak(utterance);
      console.log(`Started speaking segment: [${currentSegment.timeStr}] ${currentSegment.title}`);
    } catch (error) {
      console.error('Playback failed:', error);
    }
  }
}

// Start narration mode
function startNarration() {
  uiVisible = false;
  select("#ui").style("display", "none");
  hideSearchUI();
  video.play();
  video.volume(0);
  if (bgm) bgm.pause();
  narrationPlaying = true;
  speakCurrentSegment();
}

// Stop narration mode
function stopNarration() {
  narrationPlaying = false;
  if (speechSynthesis) speechSynthesis.cancel();
  if (video) video.pause();
}

// Set playback time
function setPlaybackTime(progress) {
  if (!video) return;
  const newTime = progress * video.duration();
  video.time(newTime);
  if (mode2 === "mv" && bgm) bgm.time(newTime);
  if (mode2 === "narration" && narrationPlaying && !paused) {
  } else if (mode2 === "narration" && narrationPlaying && paused) {
    updateCurrentSegmentIndex();
  }
}

// Update current segment index
function updateCurrentSegmentIndex() {
  if (!video || textSegments.length === 0) return;
  const currentTime = video.time();
  for (let i = textSegments.length - 1; i >= 0; i--) {
    if (currentTime >= textSegments[i].time) {
      currentSegmentIndex = i;
      console.log(`Updated to segment: [${textSegments[i].timeStr}] ${textSegments[i].title}`);
      break;
    }
  }
}

// Format time as MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Draw progress bar
function drawProgressBar() {
  if (!video || !progressBar.visible) return;
  const progress = video.time() / video.duration();
  const handleX = progressBar.x + progress * progressBar.width;
  
  push();
  fill(100, 100);
  rect(progressBar.x, progressBar.y, progressBar.width, progressBar.height, 4);
  fill(255, 200);
  rect(progressBar.x, progressBar.y, progress * progressBar.width, progressBar.height, 4);
  fill(255);
  stroke(0);
  strokeWeight(2);
  circle(handleX, progressBar.y + progressBar.height / 2, progressBar.handleRadius * 2);
  noStroke();
  fill(255);
  textSize(14);
  textAlign(CENTER, TOP);
  text(`${formatTime(video.time())} / ${formatTime(video.duration())}`, 
        progressBar.x + progressBar.width / 2, progressBar.y + 15);
  pop();
}

// Check if mouse is over progress bar handle
function isMouseOverProgressBar() {
  if (!progressBar.visible) return false;
  const progress = video.time() / video.duration();
  const handleX = progressBar.x + progress * progressBar.width;
  const handleY = progressBar.y + progressBar.height / 2;
  return dist(mouseX, mouseY, handleX, handleY) <= progressBar.handleRadius;
}

// Handle progress bar dragging
function handleProgressBarDrag() {
  if (!progressBar.dragging || !video) return;
  let progress = (mouseX - progressBar.x) / progressBar.width;
  progress = constrain(progress, 0, 1);
  setPlaybackTime(progress);
}

// Main draw loop
function draw() {
  background(0);
  if (mode1 !== "menu") {
    drawVideoAsText();
    if (paused) {
      fill(0, 180);
      rect(0, 0, width, height);
      fill(255);
      textSize(32);
      text("Paused — Press SPACE to Resume", width / 2, height / 2);
      progressBar.visible = true;
    } else {
      progressBar.visible = false;
    }
    drawProgressBar();
    drawModeInfo();
  } else {
    drawUIText();
    progressBar.visible = false;
    showSearchUI();
  }
  if (!uiVisible) noCursor();
  else cursor();
}

// Draw mode information
function drawModeInfo() {
  push();
  fill(255, 200);
  textSize(14);
  textAlign(LEFT, TOP);
  let modeText = `model: ${mode2.toUpperCase()}`;
  text(modeText, 20, 20);
  pop();
}

// Draw segment information
function drawSegmentInfo() {
  const segment = textSegments[currentSegmentIndex];
  push();
  fill(255, 200);
  textSize(16);
  textAlign(RIGHT, TOP);
  text(`[${segment.timeStr}] ${segment.title}`, width - 20, 20);
  pop();
}

// Draw UI text in menu mode
function drawUIText() {
  background(0);
  fill(255);
  textSize(32);
  if (mode2 === "mv") {
    text("Press ▶ Start MV mode", width / 2, height / 2);
  } else if (mode2 === "narration") {
    text("Press ▶ Start Narration Mode", width / 2, height / 2);
  }
}

// Start MV or narration mode
function startMV() {
  mode1 = "videoMenu";
  currentSegmentIndex = 0;
  hideSearchUI();
  if (video) video.time(0);
  if (bgm) bgm.time(0);
  
  if (mode2 === "mv") {
    uiVisible = false;
    select("#ui").style("display", uiVisible ? "block" : "none");
    video.play();
    video.volume(0);
    bgm.play();
    bgm.volume(0.6);
  } else {
    startNarration();
  }
  paused = true; 
  SpacePressed();
}

// Switch between MV and narration modes
function switchMode() {
  mode1 = "menu";
  paused = false;
  currentSegmentIndex = 0;
  progressBar.visible = false;
  stopPlayback();
  if (mode2 === "mv") mode2 = "narration";
  else mode2 = "mv";
  drawUIText();
  select("#ui").style("display", uiVisible ? "block" : "none");
}

// Stop all playback
function stopPlayback() {
  if (video) video.pause();
  if (bgm) bgm.pause();
  stopNarration();
  Tone.Transport.stop();
}

// Mouse pressed event
function mousePressed() {
  if (progressBar.visible && isMouseOverProgressBar()) {
    progressBar.dragging = true;
    return false;
  }
}

// Mouse released event
function mouseReleased() {
  progressBar.dragging = false;
}

// Mouse dragged event
function mouseDragged() {
  handleProgressBarDrag();
}

// Key pressed event
function keyPressed() {
  if (key === " ") SpacePressed();
}

// Handle space key press for pause/resume
function SpacePressed(){
  paused = !paused;
  if (mode1 !== "menu") {
    if (paused) {
      if (mode2 === "mv") {
        video.pause();
        bgm.pause();
      } else if (mode2 === "narration") {
        video.pause();
        if (speechSynthesis) speechSynthesis.pause();
      }
    } else {
      if (mode2 === "mv") {
        video.play();
        bgm.play();
      } else if (mode2 === "narration") {
        video.play();
        if (speechSynthesis) speechSynthesis.resume();
        if (narrationPlaying) speakCurrentSegment();
      }
      progressBar.visible = false;
    }
    uiVisible = paused;
    select("#ui").style("display", uiVisible ? "block" : "none");
  }
  if (paused) showSearchUI();
  else hideSearchUI();
  drawUIText();
}

// Render video as ASCII text art
function drawVideoAsText() {
  video.loadPixels();
  if (!video.pixels.length) return;
  let step = 4;
  let charIndex = 0;
  let globalCharIndex = 0;
  const currentText = getCurrentText();
  const words = currentText.split(/(\s+)/);
  let wordStartIndex = 0;
  
  for (let y = 0; y < video.height; y += step) {
    for (let x = 0; x < video.width; x += step) {
      let idx = (x + y * video.width) * 4;
      let r = video.pixels[idx];
      let g = video.pixels[idx + 1];
      let b = video.pixels[idx + 2];
      let brightnessVal = (r + g + b) / 3;
      let fontSize = map(brightnessVal, 0, 255, 30, 34);
      textSize(fontSize);
      let ch = currentText.charAt(charIndex % currentText.length);
      
      let shouldHighlight = false;
      let currentWordStart = 0;
      for (let word of words) {
        const wordEnd = currentWordStart + word.length;
        if (globalCharIndex >= currentWordStart && globalCharIndex < wordEnd) {
          const cleanWord = word.replace(/[^\w]/g, '');
          if (cleanWord && shouldHighlightWord(cleanWord)) {
            shouldHighlight = true;
            break;
          }
          currentWordStart = wordEnd;
          break;
        }
        currentWordStart = wordEnd;
      }
      
      if (shouldHighlight) fill(255, 0, 0);
      else fill(brightnessVal);
      
      charIndex++;
      globalCharIndex++;
      text(ch, (x / video.width) * width, (y / video.height) * height);
    }
  }
}