Feature: Add to Cart

  Scenario: Add a product with available size to cart and verify
    Given I open the site in "USA" country with "en" language
    When I type "dress" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "dress"
    When I click the first product from results
    And I select an available size
    And I click the "Add to Basket" button
    And I navigate to the basket page
    Then I should see the product in the basket
