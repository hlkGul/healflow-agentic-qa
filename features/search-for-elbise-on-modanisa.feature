Feature: Search on Modanisa

  Scenario: Search for "elbise" on Modanisa and verify the search results page
    Given I navigate to the Modanisa homepage
    When I type "elbise" in the search input
    And I press "Enter" in the search input
    Then I should see the search results page for "elbise"