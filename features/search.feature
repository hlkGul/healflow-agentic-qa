Feature: Search on Modanisa

  Scenario Outline: Search for '<term>' in <country> (<language>)
    Given I open the site in "<country>" country with "<language>" language
    When I type "<term>" in the search input
    And I press "Enter" in the search input
    Then I should see search results for "<term>"

    Examples:
      | country | language | term   |
      | USA     | en       | dress  |
      | Turkey  | tr       | elbise |

