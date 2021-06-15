describe('BSD and Module-Scan', () => {
  beforeEach(() => {
    // Unconfigure module-scan
    cy.request('DELETE', '/config/election')
    cy.visit('/')
    cy.contains('Load Election Configuration', { timeout: 10000 })
  })

  it('BSD can be configured with module-scan with an election JSON file', () => {
    cy.visit('/')
    cy.contains('Load Election Configuration')
    cy.get('input[type="file"]').attachFile('election.json')
    cy.contains('Close').click()
    cy.contains('No ballots have been scanned')
    cy.contains('Scan New Batch').click()
    cy.contains('A total of 0 ballots have been scanned in 1 batch.')
  })

  it('BSD can be configured with module-scan with a ZIP ballot package', () => {
    cy.visit('/')
    cy.contains('Load Election Configuration')
    cy.get('input[type="file"]').attachFile({
      filePath: 'ballot-package.zip',
    })
    cy.contains('Uploading ballot package 1 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 2 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 3 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 4 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 5 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 6 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 7 of 8', { timeout: 10000 })
    cy.contains('Uploading ballot package 8 of 8', { timeout: 10000 })
    cy.contains('Preparing scanner', { timeout: 10000 })
    cy.contains('Ballot Scanner Configured', { timeout: 20000 })
    cy.contains('Close').click()
    cy.contains('No ballots have been scanned')
    cy.contains('Scan New Batch').click()
    cy.contains('A total of 0 ballots have been scanned in 1 batch.')
  })

  it('BSD can configure advanced options ', () => {
    cy.visit('/')
    cy.contains('Load Election Configuration')
    cy.get('input[type="file"]').attachFile('election.json')
    cy.contains('Close').click()
    cy.contains('No ballots have been scanned')
    cy.contains('Scan New Batch').click()
    cy.contains('Advanced').click()
    cy.contains('Toggle to Test Mode').click()
    cy.get('button[data-testid="confirm-toggle"]')
      .contains('Toggle to Test Mode')
      .click()
    cy.contains('Ballot Scanner TEST MODE', { timeout: 20000 })
    cy.contains('No ballots have been scanned')
    cy.contains('Scan New Batch').click()
    cy.contains('Advanced').click()
    cy.contains('Toggle to Live Mode')
    cy.contains('Delete Ballot Data').click()
    cy.contains('Yes, Delete Ballot Data').click()
    cy.contains('No ballots have been scanned', { timeout: 10000 })
    cy.contains('Scan New Batch').click()
    cy.contains('Advanced').click()
    cy.contains('Factory Reset').click()
    cy.contains('Yes, Factory Reset').click()
    cy.contains('Load Election Configuration', { timeout: 10000 })
  })
})
