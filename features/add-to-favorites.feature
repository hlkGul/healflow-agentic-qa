Feature: Add product to favorites from listing

  Scenario: Add first product to favorites and verify icon changes
    Given I open the site in "USA" country with "en" language
    When I type "dress" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "dress"
    When I click the favorite icon on the first product
    Then the favorite icon should change to favorited state
