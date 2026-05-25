Feature: Price Verification between Listing and Detail

  Scenario: Verify first product's prices match between listing and detail page
    Given I open the site in "USA" country with "en" language
    When I type "dress" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "dress"
    When I capture the first discounted product's prices from the listing
    And I click the first discounted product
    Then the detail page prices should match the listing prices
