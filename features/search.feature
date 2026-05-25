Feature: Search on Modanisa

  Scenario: Search for 'dress' and verify results
    Given I open the site in "USA" country with "en" language
    When I type "dress" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "dress"
