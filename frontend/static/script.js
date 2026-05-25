document.addEventListener('DOMContentLoaded', function() {
    const addLineBtn = document.getElementById('add-line-btn');
    const form = document.getElementById('add-quote');

    addLineBtn.addEventListener('click', function() {
        // Find the first dialogue row layout & clone it
        const originalRow = document.querySelector('.line-row');
        const newRow = originalRow.cloneNode(true);
        
        // Clear out the inputs of the cloned fields
        const inputs = newRow.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
        const select = newRow.querySelector('select');
        if (select) select.value = '';

        // Insert the new empty row
        const flexGroups = form.querySelectorAll('.flex-group');
        const dateGroup = flexGroups[flexGroups.length - 3];
        
        form.insertBefore(newRow, dateGroup);
    });
});