// Journal Module
function insertHtmlOnNewLine(html) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
    
    // Insert a <br> to move to a new line
    const br = document.createElement('br');
    range.insertNode(br);
    
    // Insert the HTML content
    const el = document.createElement('div');
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    const nodes = [];
    while ((node = el.firstChild)) {
      nodes.push(node);
      frag.appendChild(node);
    }
    range.insertNode(frag);

    // Update the range to after the inserted content
    // const insertedNodes = frag.childNodes;
    if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        range.setStartAfter(lastNode);
        range.setEndAfter(lastNode);
    
        selection.removeAllRanges();
        selection.addRange(range);
        
        return lastNode;
    }
    }
    return null;
}

function placeCursorAtEnd(element) {
  if (!element) return;

  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function saveContent(index) {
  fs.writeFile(dataFile[index], textBox[index].innerHTML, (err) => {
    if (err) console.error('Failed to save content:', err);
  });
}

function saveMoodJournals() {
  const moodJournalsFile = path.join(dataDir, 'moodJournals.json');
  fs.writeFile(moodJournalsFile, JSON.stringify(moodJournals, null, 2), (err) => {
    if (err) console.error('Failed to save mood journals:', err);
  });
}

function toggleJournalMode(box, index) {
    if (!journalActive) {
      // Start journal mode
      journalActive = true;
      journalContent = '';
      
      // Insert Journal Container on the next line
      const journalContainer = '<p class="journal-entry" contenteditable="true" style="white-space: pre-wrap;">Journal mode active. Type your entry here. Use -j to end.</p>';
      const journalNode = insertHtmlOnNewLine(journalContainer);
  
      // Ensure the cursor is placed inside the journal-entry on a new line
      if (journalNode && journalNode.classList.contains('journal-entry')) {
        // Programmatically insert a new line (Enter key equivalent) and place cursor inside
        const newLine = document.createElement('br');  // Create a new line break
        journalNode.appendChild(newLine);  // Add the line break inside the journal entry
        placeCursorAtEnd(journalNode);  // Place the cursor at the end of the journal entry
      } else {
        console.error('Journal node not found or does not have the correct class');
      }
      saveContent(index);
    } else {
      // End journal mode
      journalActive = false;
      // Extract journal content
      const journalEntry = box.querySelector('.journal-entry');
      let journalText = '';
      if (journalEntry) {
        journalText = journalEntry.innerText;
        journalEntry.remove();
      }
      
      const timestamp = new Date().toISOString();
      moodJournals.push({
        timestamp: timestamp,
        journal: journalText,
        mood: ""
      });
      saveMoodJournals();
      insertTextAtCursor('');
      saveContent(index);
      // Add status label
      const statusLabel = document.getElementById('status-label');
      statusLabel.textContent = 'Journal saved';
      setTimeout(() => { statusLabel.textContent = ''; }, 5000);
    }
  }
  
export default {
  toggleJournalMode,
  saveContent,
  saveMoodJournals,
};


// let journalActive = false;
// let journalContent = '';
// let moodJournals = [];

// const toggleJournalMode = (box, index) => {
//   if (!journalActive) {
//     journalActive = true;
//     journalContent = '';
//     const journalContainer = '<p class="journal-entry">Journal mode active. Use -j to end.</p>';
//     Utils.insertHtmlOnNewLine(journalContainer);
//   } else {
//     journalActive = false;
//     const journalEntry = box.querySelector('.journal-entry');
//     if (journalEntry) {
//       journalContent = journalEntry.innerText;
//       moodJournals.push({ timestamp: new Date().toISOString(), journal: journalContent });
//     }
//     box.innerHTML += '<p>Journal saved</p>';
//     Storage.saveContent(index);
//   }
// };

// module.exports = {
//   toggleJournalMode,
// };
