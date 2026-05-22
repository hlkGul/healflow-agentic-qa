Feature: Search on Modanisa

  Scenario: Search for 'elbise' and verify results
    Given I navigate to the Modanisa homepage
    When I type "elbise" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "elbise"
