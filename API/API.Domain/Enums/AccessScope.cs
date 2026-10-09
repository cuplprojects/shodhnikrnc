namespace API.Domain.Enums;

/// <summary>
/// How much of a page's data a permission reaches.
/// </summary>
/// <remarks>
/// Page access answers "may this user open the page"; scope answers "which rows
/// do they see once it is open". Both are needed: granting proposal review to
/// the HOD role without a scope would let every HOD see every department's
/// proposals.
///
/// Ordered narrowest to widest, and compared by value when resolving the widest
/// scope a user holds -- so the order is meaningful and must not be rearranged.
/// Persisted as ints; append only.
/// </remarks>
public enum AccessScope
{
    /// <summary>Rows the user owns — a PI's own projects.</summary>
    Own = 0,

    /// <summary>Rows belonging to the user's department — an HOD's view.</summary>
    Department = 1,

    /// <summary>Every row — Dean, Director, and the R&amp;C office.</summary>
    Institute = 2,
}
