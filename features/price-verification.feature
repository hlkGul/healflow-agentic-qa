Feature: Price Verification between Listing and Detail

  Scenario Outline: Verify prices match between listing and detail in <country> (<language>)
    Given I open the site in "<country>" country with "<language>" language
    When I type "<term>" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "<term>"
    When I capture the first discounted product's prices from the listing
    And I click the first discounted product
    Then the detail page prices should match the listing prices

    Examples:
      | country | language | term   |
      | USA     | en       | dress  |
      | Turkey  | tr       | elbise |
      | Germany | de       | Hosen  |
