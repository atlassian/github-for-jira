{
	"Comment": "State Machine to calculate net run rates for given teams.",
	"StartAt": "CreateMatches",
	"States": {
		"CreateMatches": {
			"Type": "Task",
			"Resource": "arn:aws:lambda:us-east-1:123456789012:function:CreateMatchesFunction",
			"Next": "CalculateRunRate"
		},
		"CalculateRunRate": {
			"Type": "Task",
			"Resource": "arn:aws:lambda:us-east-1:123456789012:function:CalculateRunRateFunction",
			"End": true
		}
	}
}
