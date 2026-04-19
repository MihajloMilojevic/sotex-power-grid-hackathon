create table dbo.Channels
(
    Id   int identity
            constraint PK_Channels
                primary key,
    Name nvarchar(100),
    Unit nvarchar(30)
)
    go

create table dbo.DistributionSubstation
(
    Id              int identity
            constraint PK_DistributionSubstation
                primary key,
    Name            nvarchar(100),
    MeterId         int,
    Feeder11Id      int,
    Feeder33Id      int,
    NameplateRating int,
    Latitude        decimal(12, 9),
    Longitude       decimal(12, 9)
)
    go

create table dbo.Feeder33Substation
(
    Feeders33Id   int not null,
    SubstationsId int not null,
    constraint PK_Feeder33Substation
        primary key (Feeders33Id, SubstationsId)
)
    go

create table dbo.Feeders11
(
    Id              int identity
            constraint PK_Feeders11
                primary key,
    Name            nvarchar(150),
    SsId            int,
    MeterId         int,
    Feeder33Id      int,
    NameplateRating int,
    TsId            int
)
    go

create table dbo.Feeders33
(
    Id              int identity
            constraint PK_Feeders33
                primary key,
    Name            nvarchar(150),
    TsId            int,
    IsDeleted       bit not null,
    MeterId         int,
    NameplateRating int
)
    go

create table dbo.MeterReadTfes
(
    Id  bigint identity,
    Mid int       not null,
    Val float     not null,
    Ts  datetime2 not null,
    constraint PK_MeterReadTfes
        primary key (Id, Ts)
)
    go

create table dbo.MeterReads
(
    Id  bigint identity,
    Mid int       not null,
    Val float     not null,
    Ts  datetime2 not null,
    Cid int       not null,
    constraint PK_MeterReads
        primary key (Id, Ts)
)
    go

create table dbo.Meters
(
    Id               int identity
            constraint PK_Meters
                primary key,
    MSN              nvarchar(40),
    MultiplierFactor float not null
)
    go

create table dbo.Substations
(
    Id        int identity
            constraint PK_Substations
                primary key,
    Name      nvarchar(50),
    Latitude  decimal(12, 9),
    Longitude decimal(12, 9)
)
    go

create table dbo.TransmissionStations
(
    Id        int identity
            constraint PK_TransmissionStations
                primary key,
    Name      nvarchar(100),
    Latitude  decimal(12, 9),
    Longitude decimal(12, 9)
)
    go

